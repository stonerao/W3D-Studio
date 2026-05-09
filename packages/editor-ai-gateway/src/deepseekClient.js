import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { config } from './config.js';

const requestJson = (url, payload, { headers = {}, timeoutMs = 60000 } = {}) => {
    const target = new URL(url);
    const client = target.protocol === 'http:' ? http : https;
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const req = client.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                ...headers
            },
            timeout: timeoutMs
        }, (res) => {
            const chunks = [];

            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let data = null;
                try {
                    data = text ? JSON.parse(text) : null;
                } catch {
                    data = { raw: text };
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    const message = data?.error?.message || data?.message || `AI provider request failed: ${res.statusCode}`;
                    const error = new Error(message);
                    error.statusCode = res.statusCode;
                    error.details = data;
                    reject(error);
                    return;
                }

                resolve(data);
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error(`AI provider request timeout after ${timeoutMs}ms`));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
};

const resolveChatEndpoint = (baseUrl) => {
    const normalized = String(baseUrl || '').replace(/\/$/, '');
    return normalized.endsWith('/chat/completions')
        ? normalized
        : `${normalized}/chat/completions`;
};

export const callAIChatCompletion = async ({ messages, provider, temperature = 0.2 }) => {
    const payload = {
        model: provider.model,
        messages,
        temperature
    };

    if (provider.supportsJsonMode !== false) {
        payload.response_format = { type: 'json_object' };
    }

    return requestJson(resolveChatEndpoint(provider.baseUrl), payload, {
        timeoutMs: config.timeoutMs,
        headers: {
            Authorization: `Bearer ${provider.apiKey}`
        }
    });
};
