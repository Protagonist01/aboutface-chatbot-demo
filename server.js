// =============================================================
// about-face RAG Chatbot — Express Server
// Serves static frontend + /api/chat RAG endpoint
// =============================================================

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH || 800);
const MAX_HISTORY_ITEMS = Number(process.env.MAX_HISTORY_ITEMS || 6);
const IP_RATE_LIMIT_WINDOW_MS = Number(process.env.IP_RATE_LIMIT_WINDOW_MS || 60_000);
const IP_RATE_LIMIT_MAX_REQUESTS = Number(process.env.IP_RATE_LIMIT_MAX_REQUESTS || 8);
const DAILY_GLOBAL_REQUEST_LIMIT = Number(process.env.DAILY_GLOBAL_REQUEST_LIMIT || 250);

const ipRequests = new Map();
let dailyUsage = {
    day: new Date().toISOString().slice(0, 10),
    count: 0,
};

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function pruneOldIpRequests(now) {
    for (const [ip, timestamps] of ipRequests.entries()) {
        const recent = timestamps.filter((timestamp) => now - timestamp < IP_RATE_LIMIT_WINDOW_MS);
        if (recent.length) {
            ipRequests.set(ip, recent);
        } else {
            ipRequests.delete(ip);
        }
    }
}

function resetDailyUsageIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (dailyUsage.day !== today) {
        dailyUsage = { day: today, count: 0 };
    }
}

function enforceUsageLimits(req, res, next) {
    const now = Date.now();
    const ip = getClientIp(req);

    pruneOldIpRequests(now);
    resetDailyUsageIfNeeded();

    const requests = ipRequests.get(ip) || [];
    if (requests.length >= IP_RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            reply: "the demo is taking a quick breather. please try again in a minute.",
        });
    }

    if (dailyUsage.count >= DAILY_GLOBAL_REQUEST_LIMIT) {
        return res.status(429).json({
            error: 'Daily demo limit reached',
            reply: "the public demo has reached today's usage limit. please try again tomorrow.",
        });
    }

    requests.push(now);
    ipRequests.set(ip, requests);
    dailyUsage.count += 1;
    next();
}

function sanitizeHistory(history) {
    if (!Array.isArray(history)) return [];
    return history
        .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
        .slice(-MAX_HISTORY_ITEMS)
        .map((msg) => ({
            role: msg.role,
            content: msg.content.slice(0, MAX_MESSAGE_LENGTH),
        }));
}

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Chat API Endpoint ─────────────────────────────────────
app.post('/api/chat', enforceUsageLimits, async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        const trimmedMessage = message.trim();
        if (!trimmedMessage) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
            return res.status(413).json({
                error: 'Message is too long',
                reply: `please keep demo messages under ${MAX_MESSAGE_LENGTH} characters.`,
            });
        }

        // Dynamic import to avoid top-level Pinecone/OpenAI init at startup
        const { handleChat } = await import('./rag-engine.js');
        const reply = await handleChat(trimmedMessage, sanitizeHistory(history));
        res.json({ reply });
    } catch (error) {
        console.error('[/api/chat] Error:', error.message);
        res.status(500).json({
            error: 'Internal server error',
            reply: "sorry, i'm having trouble right now. please try again in a moment. 💚",
        });
    }
});

// ── Health Check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start Server ──────────────────────────────────────────
// Only listen if run directly (local dev), otherwise export for Vercel
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`\n  ✦ about-face chatbot running at http://localhost:${PORT}`);
        console.log(`  ✦ API endpoint: http://localhost:${PORT}/api/chat\n`);
    });
}

export default app;
