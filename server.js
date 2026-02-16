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

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Chat API Endpoint ─────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Dynamic import to avoid top-level Pinecone/OpenAI init at startup
        const { handleChat } = await import('./rag-engine.js');
        const reply = await handleChat(message, history || []);
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
app.listen(PORT, () => {
    console.log(`\n  ✦ about-face chatbot running at http://localhost:${PORT}`);
    console.log(`  ✦ API endpoint: http://localhost:${PORT}/api/chat\n`);
});
