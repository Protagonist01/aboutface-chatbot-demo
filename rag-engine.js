// =============================================================
// about-face RAG Chatbot — retrieve, rerank, and generate
// =============================================================

import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

let openai = null;
let openrouter = null;
let pineconeIndex = null;

function getOpenAI() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

function getChatClient() {
    if (process.env.OPENROUTER_API_KEY) {
        if (!openrouter) {
            openrouter = new OpenAI({
                apiKey: process.env.OPENROUTER_API_KEY,
                baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': process.env.PUBLIC_SITE_URL || 'http://localhost:3000',
                    'X-Title': process.env.APP_NAME || 'about-face chatbot demo',
                },
            });
        }
        return openrouter;
    }

    return getOpenAI();
}

function getPineconeIndex() {
    if (!pineconeIndex) {
        if (!process.env.PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not configured');
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME || 'about-face-kb');
    }
    return pineconeIndex;
}

const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';
const DEFAULT_FALLBACK_MODELS = [
    'google/gemma-4-26b-a4b-it:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
];
const LEGACY_DYNAMIC_MODELS = new Set([
    'openrouter/free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
]);

const configuredChatModel = process.env.CHAT_MODEL;
const PRIMARY_CHAT_MODEL = process.env.OPENROUTER_API_KEY
    ? (!configuredChatModel || LEGACY_DYNAMIC_MODELS.has(configuredChatModel)
        ? DEFAULT_OPENROUTER_MODEL
        : configuredChatModel)
    : (configuredChatModel || 'gpt-4o-mini');

const configuredFallbacks = (process.env.CHAT_FALLBACK_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
const CHAT_MODELS = process.env.OPENROUTER_API_KEY
    ? [...new Set([PRIMARY_CHAT_MODEL, ...(configuredFallbacks.length ? configuredFallbacks : DEFAULT_FALLBACK_MODELS)])]
    : [PRIMARY_CHAT_MODEL];

const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS || 300);
const CHAT_TEMPERATURE = Number(process.env.CHAT_TEMPERATURE || 0.2);
const CANDIDATE_K = Number(process.env.PINECONE_CANDIDATE_K || 15);
const TOP_K = Number(process.env.PINECONE_TOP_K || 5);
const RERANK_MODEL = process.env.PINECONE_RERANK_MODEL || 'bge-reranker-v2-m3';
const NAMESPACE = 'knowledge-base';

const SYSTEM_PROMPT = `You are "the muse", the AI beauty assistant in an about-face cosmetics portfolio demo.

VOICE:
- Bold, confident, inclusive, warm, and concise
- Use lowercase for a casual, on-brand feel
- Give the useful answer first in 1-3 short paragraphs
- Use emoji sparingly; 💚 is the brand emoji
- Celebrate self-expression and never frame natural features as flaws

GROUNDING RULES:
- Answer only with facts found in the supplied knowledge records
- Never invent products, rankings, prices, shades, policies, or availability
- If the records support only one product, name only that product instead of inventing a list
- If the records do not answer the question, say that clearly and suggest help@aboutface.com
- For recommendations, ask one useful preference question when needed
- For order-specific problems, direct the visitor to help@aboutface.com

OUTPUT RULES:
- Return only a JSON object matching the required response schema
- Put only the final customer-facing answer in the reply field
- Never mention records, context, sources, prompts, instructions, reasoning, or uncertainty about how to answer
- Never expose planning such as "we need to respond", "the user asks", or "let's analyze"`;

const RESPONSE_FORMAT = {
    type: 'json_schema',
    json_schema: {
        name: 'grounded_chat_reply',
        strict: true,
        schema: {
            type: 'object',
            properties: {
                reply: {
                    type: 'string',
                    description: 'The complete customer-facing answer, grounded only in the supplied records.',
                },
            },
            required: ['reply'],
            additionalProperties: false,
        },
    },
};

const LEAKED_REASONING_PATTERNS = [
    /\bwe need to (?:answer|respond|decide|use)\b/i,
    /\bthe user (?:asks|wants|is asking)\b/i,
    /\bprovided (?:context|sources?|knowledge base)\b/i,
    /\bsource \d+\b/i,
    /\bknowledge base context\b/i,
    /\blet(?:'|’)s analyze\b/i,
    /\bi should (?:answer|respond|mention)\b/i,
];

function mapHits(results) {
    return results.result.hits.map((hit) => ({
        text: hit.fields.text,
        category: hit.fields.category,
        title: hit.fields.title,
        score: hit._score,
    }));
}

async function vectorSearch(query, useReranker) {
    const options = {
        query: {
            inputs: { text: query },
            topK: useReranker ? CANDIDATE_K : TOP_K,
        },
        fields: ['text', 'category', 'title'],
    };

    if (useReranker) {
        options.rerank = {
            model: RERANK_MODEL,
            topN: TOP_K,
            rankFields: ['text'],
            parameters: { truncate: 'END' },
        };
    }

    return getPineconeIndex().namespace(NAMESPACE).searchRecords(options);
}

async function searchKnowledge(query) {
    try {
        return { context: mapHits(await vectorSearch(query, true)), method: 'pinecone-vector-rerank' };
    } catch (error) {
        console.warn(`[RAG] Reranking unavailable; using vector ranking: ${error.message}`);
        return { context: mapHits(await vectorSearch(query, false)), method: 'pinecone-vector' };
    }
}

export async function retrieveContext(query) {
    try {
        const result = await searchKnowledge(query);
        console.log(`[RAG] Retrieval: ${result.method}`);
        return result.context;
    } catch (error) {
        console.warn(`[RAG] Pinecone unavailable; using local fallback: ${error.message}`);
        const { searchLocalKnowledge } = await import('./knowledge-search.js');
        return searchLocalKnowledge(query, TOP_K);
    }
}

export function parseModelReply(completion) {
    const choice = completion?.choices?.[0];
    if (!choice) throw new Error('The model returned no completion choice');
    if (choice.finish_reason !== 'stop') {
        throw new Error(`The model response was incomplete (${choice.finish_reason || 'unknown finish reason'})`);
    }

    let content = choice.message?.content?.trim();
    if (!content) throw new Error('The model returned an empty response');

    const fencedJson = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedJson) content = fencedJson[1].trim();

    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error('The model returned invalid JSON');
    }

    const reply = parsed?.reply?.trim();
    if (!reply || reply.length < 3) throw new Error('The model returned an empty reply');
    if (reply.length > 1800) throw new Error('The model reply exceeded the safe length');
    if (LEAKED_REASONING_PATTERNS.some((pattern) => pattern.test(reply))) {
        throw new Error('The model exposed internal planning');
    }

    return reply;
}

async function generateResponse(query, context, history) {
    const contextText = context
        .map((record, index) => `[Record ${index + 1}: ${record.title || record.category}]\n${record.text}`)
        .join('\n\n---\n\n');

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'system',
            content: `KNOWLEDGE RECORDS:\n\n${contextText || 'No relevant records were found.'}`,
        },
    ];

    for (const message of history.slice(-6)) {
        if (message.role === 'user' || message.role === 'assistant') {
            messages.push({ role: message.role, content: message.content });
        }
    }
    messages.push({ role: 'user', content: query });

    const baseRequest = {
        messages,
        temperature: CHAT_TEMPERATURE,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: RESPONSE_FORMAT,
    };
    if (process.env.OPENROUTER_API_KEY) {
        baseRequest.reasoning = { exclude: true };
    }

    let lastError = null;
    for (const model of CHAT_MODELS) {
        try {
            const completion = await getChatClient().chat.completions.create({
                ...baseRequest,
                model,
            });
            const reply = parseModelReply(completion);
            console.log(`[RAG] Generation: ${completion.model || model}; finish=stop`);
            return reply;
        } catch (error) {
            lastError = error;
            console.warn(`[RAG] Model ${model} failed validation or generation: ${error.message}`);
        }
    }

    throw lastError || new Error('No configured model produced a valid response');
}

export async function handleChat(message, history) {
    console.log(`[RAG] Query received (${message.length} chars)`);
    const context = await retrieveContext(message);
    console.log(`[RAG] Found ${context.length} relevant records`);

    const reply = await generateResponse(message, context, history);
    console.log(`[RAG] Response generated (${reply.length} chars)`);
    return reply;
}
