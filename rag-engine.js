// =============================================================
// about-face RAG Chatbot — RAG Engine
// Pipeline: Embed query → Search Pinecone → Generate response
// =============================================================

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// ── Lazy-initialized clients ──────────────────────────────
let openai = null;
let pineconeIndex = null;

function getOpenAI() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set in .env');
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

function getPineconeIndex() {
    if (!pineconeIndex) {
        if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not set in .env');
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME || 'about-face-kb');
    }
    return pineconeIndex;
}

// ── Constants ─────────────────────────────────────────────
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';
const TOP_K = 5;
const NAMESPACE = 'knowledge-base';

// ── System Prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `You are "the muse" — the official AI beauty alter ego for about-face, the cosmetics brand founded by Halsey. You are NOT a generic chatbot; you are a creative, bold companion who helps people express themselves through makeup.

PERSONALITY & TONE:
- Bold, confident, inclusive, and warm
- Use lowercase for a casual, on-brand feel
- Keep responses concise but helpful (2-4 short paragraphs max)
- Use emoji sparingly (💚 is the brand emoji)
- Never use traditional beauty standard language ("flawless," "perfect," "conceal")
- Celebrate self-expression and creativity
- Sound like a knowledgeable friend, not a corporate bot

RULES:
- ONLY answer questions using the provided knowledge base context
- If the context doesn't contain enough information, say so honestly and suggest contacting help@aboutface.com
- Always mention specific product names, prices, and shade details when relevant
- For product recommendations, ask about their preferences (skin type, desired look, occasion)
- For order issues, direct to help@aboutface.com
- Never make up information not in the context
- Keep all text lowercase to match brand voice
- Format product names in their official style (e.g., "matte fluid eye paint", "the performer foundation")

BRAND FACTS TO REMEMBER:
- 100% vegan and cruelty-free
- Clean beauty — no parabens, phthalates, gluten, synthetic fragrances
- Founded January 25, 2021
- Available at aboutface.com and Ulta Beauty
- Free US shipping on orders over $30`;

// ── Embed Query ───────────────────────────────────────────
async function embedQuery(text) {
    const response = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        dimensions: 512,
    });
    return response.data[0].embedding;
}

// ── Search Pinecone ───────────────────────────────────────
async function searchKnowledge(queryEmbedding) {
    const results = await getPineconeIndex().namespace(NAMESPACE).query({
        vector: queryEmbedding,
        topK: TOP_K,
        includeMetadata: true,
    });

    return results.matches
        .filter((match) => match.score >= 0.3)
        .map((match) => ({
            text: match.metadata.text,
            category: match.metadata.category,
            score: match.score,
        }));
}

// ── Generate Response ─────────────────────────────────────
async function generateResponse(query, context, history) {
    const contextStr = context
        .map((c, i) => `[Source ${i + 1} — ${c.category}] (relevance: ${(c.score * 100).toFixed(0)}%)\n${c.text}`)
        .join('\n\n---\n\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'system',
            content: `KNOWLEDGE BASE CONTEXT (use this to answer the user's question):\n\n${contextStr || 'No relevant context found.'}`,
        },
    ];

    const recentHistory = history.slice(-6);
    for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content });
        }
    }

    messages.push({ role: 'user', content: query });

    const completion = await getOpenAI().chat.completions.create({
        model: CHAT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
    });

    return completion.choices[0].message.content;
}

// ── Main Handler ──────────────────────────────────────────
export async function handleChat(message, history) {
    console.log(`[RAG] Query: "${message}"`);

    const queryEmbedding = await embedQuery(message);
    const context = await searchKnowledge(queryEmbedding);
    console.log(`[RAG] Found ${context.length} relevant chunks`);

    const reply = await generateResponse(message, context, history);
    console.log(`[RAG] Response generated (${reply.length} chars)`);

    return reply;
}
