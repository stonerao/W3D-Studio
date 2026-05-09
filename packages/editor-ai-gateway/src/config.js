import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(packageRoot, '..', '..');

const parseEnvLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return null;

    const index = trimmed.indexOf('=');
    if (index === -1) return null;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (!key) return null;

    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }

    return [key, value];
};

const loadEnvFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
        const entry = parseEnvLine(line);
        if (!entry) return;
        const [key, value] = entry;
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    });
};

[
    path.join(workspaceRoot, '.env'),
    path.join(workspaceRoot, '.env.local'),
    path.join(packageRoot, '.env'),
    path.join(packageRoot, '.env.local')
].forEach(loadEnvFile);

const toNumber = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

export const config = {
    host: process.env.AI_GATEWAY_HOST || '0.0.0.0',
    port: toNumber(process.env.AI_GATEWAY_PORT, 8787),
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    timeoutMs: toNumber(process.env.DEEPSEEK_TIMEOUT_MS, 60000),
    maxInputChars: toNumber(process.env.AI_GATEWAY_MAX_INPUT_CHARS, 120000),
    maxHistoryMessages: toNumber(process.env.AI_GATEWAY_MAX_HISTORY_MESSAGES, 12)
};
