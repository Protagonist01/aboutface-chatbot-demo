// =============================================================
// about-face RAG Chatbot — Knowledge Base Seeder
// Chunks the markdown KB, embeds via OpenAI, upserts to Pinecone
// Run once: node seed-knowledge.js
// =============================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'about-face-kb';
const NAMESPACE = 'knowledge-base';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 20;

// ── Category mapping from section headers ──────────────────
const CATEGORY_MAP = {
    'BRAND OVERVIEW': 'brand',
    'PRODUCT PHILOSOPHY': 'brand',
    'PRODUCT CATEGORIES': 'products',
    'SPECIAL COLLECTIONS': 'products',
    'PRICING STRUCTURE': 'pricing',
    'WHERE TO BUY': 'shopping',
    'SHIPPING & DELIVERY': 'shipping',
    'RETURNS & EXCHANGES': 'returns',
    'CUSTOMER SERVICE': 'support',
    'LOYALTY & REWARDS': 'loyalty',
    'AWARDS & RECOGNITION': 'brand',
    'BRAND PARTNERSHIPS': 'brand',
    'PRODUCT FORMULATION': 'ingredients',
    'APPLICATION TIPS': 'tips',
    'SHADE MATCHING': 'shades',
    'SOCIAL MEDIA': 'community',
    'SUSTAINABILITY': 'sustainability',
    'FREQUENTLY ASKED': 'faq',
    'COMPETITIVE POSITIONING': 'brand',
    'PRODUCT INNOVATION': 'products',
    'CUSTOMER TESTIMONIALS': 'reviews',
    'TROUBLESHOOTING': 'support',
    'CONTACT & SUPPORT': 'support',
    'BRAND VOICE': 'brand',
    'KEYWORD OPTIMIZATION': 'seo',
};

// ── Chunk the knowledge base ───────────────────────────────
function chunkKnowledgeBase(markdown) {
    const chunks = [];
    const sections = markdown.split(/\n## \d+\.\s+/);

    for (const section of sections) {
        if (!section.trim()) continue;

        // Determine category from section header
        const headerMatch = section.match(/^([A-Z &']+)/);
        let category = 'general';
        if (headerMatch) {
            const header = headerMatch[1].trim();
            for (const [key, value] of Object.entries(CATEGORY_MAP)) {
                if (header.includes(key)) {
                    category = value;
                    break;
                }
            }
        }

        // Split section into subsections by ###
        const subsections = section.split(/\n### /);

        for (const sub of subsections) {
            if (!sub.trim()) continue;

            const text = sub.trim();

            // If the subsection is too long, split by #### headers
            if (text.length > 1500) {
                const subparts = text.split(/\n#### /);
                for (const part of subparts) {
                    if (part.trim() && part.trim().length > 50) {
                        chunks.push({
                            text: part.trim().slice(0, 2000),
                            category,
                        });
                    }
                }
            } else if (text.length > 50) {
                chunks.push({ text, category });
            }
        }
    }

    return chunks;
}

// ── Embed chunks in batches ────────────────────────────────
async function embedChunks(chunks) {
    const embeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map((c) => c.text);

        console.log(`  embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`);

        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: texts,
            dimensions: 512,
        });

        for (let j = 0; j < response.data.length; j++) {
            embeddings.push({
                id: `chunk-${i + j}`,
                values: response.data[j].embedding,
                metadata: {
                    text: batch[j].text,
                    category: batch[j].category,
                },
            });
        }

        // Rate limit safety
        if (i + BATCH_SIZE < chunks.length) {
            await new Promise((r) => setTimeout(r, 200));
        }
    }

    return embeddings;
}

// ── Upsert to Pinecone ─────────────────────────────────────
async function upsertToPinecone(vectors) {
    const index = pinecone.index(INDEX_NAME);

    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
        const batch = vectors.slice(i, i + BATCH_SIZE);
        console.log(`  upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}...`);

        await index.namespace(NAMESPACE).upsert({ records: batch });
    }
}

// ── Main ───────────────────────────────────────────────────
async function main() {
    console.log('\n✦ about-face knowledge base seeder\n');

    // 1. Read knowledge base
    const kbPath = path.join(__dirname, 'about-face-knowledge-base.md');
    if (!fs.existsSync(kbPath)) {
        console.error('✗ knowledge base file not found:', kbPath);
        process.exit(1);
    }

    const markdown = fs.readFileSync(kbPath, 'utf-8');
    console.log(`✓ loaded knowledge base (${markdown.length} chars)`);

    // 2. Chunk
    const chunks = chunkKnowledgeBase(markdown);
    console.log(`✓ chunked into ${chunks.length} segments`);

    // Log chunk distribution
    const catCounts = {};
    chunks.forEach((c) => {
        catCounts[c.category] = (catCounts[c.category] || 0) + 1;
    });
    console.log('  distribution:', catCounts);

    // 3. Embed
    console.log('\n⟳ embedding chunks...');
    const vectors = await embedChunks(chunks);
    console.log(`✓ embedded ${vectors.length} vectors`);

    // 4. Upsert to Pinecone
    console.log('\n⟳ upserting to pinecone...');
    await upsertToPinecone(vectors);
    console.log(`✓ upserted ${vectors.length} vectors to index "${INDEX_NAME}"\n`);

    console.log('✦ knowledge base seeded successfully! you can now run the chatbot.\n');
}

main().catch((err) => {
    console.error('✗ seeding failed:', err.message);
    process.exit(1);
});
