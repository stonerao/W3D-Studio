import http from 'node:http';
import { config } from './config.js';
import { callAIChatCompletion } from './deepseekClient.js';
import { buildChatMessages, parseAssistantJson, resolveDeterministicW3DResponse } from './prompt.js';
import { getPublicDefaultProviderConfig, normalizeProviderConfig } from './providerConfig.js';

const sendJson = (res, statusCode, payload) => {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    res.end(body);
};

const readJsonBody = (req) => new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
        total += chunk.length;
        if (total > config.maxInputChars) {
            reject(new Error('Request body is too large'));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) {
            resolve({});
            return;
        }
        try {
            resolve(JSON.parse(text));
        } catch {
            reject(new Error('Invalid JSON request body'));
        }
    });
    req.on('error', reject);
});

const normalizeAiResponse = (payload) => ({
    message: String(payload?.message || ''),
    actions: Array.isArray(payload?.actions) ? payload.actions : [],
    requireConfirmation: payload?.requireConfirmation === true,
    actionSummary: String(payload?.actionSummary || '')
});

const handleChat = async (req, res) => {
    const body = await readJsonBody(req);
    const message = String(body?.message || '').trim();
    const locale = String(body?.locale || body?.context?.locale || 'zh').trim();
    if (!message) {
        sendJson(res, 400, { error: 'message is required' });
        return;
    }

    const deterministicResponse = resolveDeterministicW3DResponse({
        message,
        context: body.context || {},
        locale
    });
    if (deterministicResponse) {
        sendJson(res, 200, {
            ...normalizeAiResponse(deterministicResponse),
            model: 'w3d-rules',
            provider: 'local-rule',
            usage: null
        });
        return;
    }

    const messages = buildChatMessages({
        message,
        history: Array.isArray(body.history)
            ? body.history.slice(-config.maxHistoryMessages)
            : [],
        context: body.context || {},
        locale
    });

    const provider = normalizeProviderConfig(body.provider || {});
    const completion = await callAIChatCompletion({ messages, provider });
    const content = completion?.choices?.[0]?.message?.content || '';
    const parsed = parseAssistantJson(content);

    sendJson(res, 200, {
        ...normalizeAiResponse(parsed),
        model: completion?.model || config.model,
        provider: provider.provider,
        usage: completion?.usage || null
    });
};

const server = http.createServer(async (req, res) => {
    try {
        if (req.method === 'OPTIONS') {
            sendJson(res, 204, {});
            return;
        }

        if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/ai/health')) {
            sendJson(res, 200, {
                ok: true,
                ...getPublicDefaultProviderConfig()
            });
            return;
        }

        if (req.method === 'POST' && req.url === '/api/ai/chat') {
            await handleChat(req, res);
            return;
        }

        sendJson(res, 404, { error: 'Not Found' });
    } catch (error) {
        sendJson(res, error.statusCode || 500, {
            error: error.message || 'AI gateway failed'
        });
    }
});

server.listen(config.port, config.host, () => {
    console.log(`[editor-ai-gateway] listening on http://${config.host}:${config.port}`);
    console.log(`[editor-ai-gateway] model=${config.model} keyConfigured=${Boolean(config.apiKey)}`);
});
