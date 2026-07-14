// =============================================================
// about-face RAG Chatbot — Pinecone integrated-inference seeder
// Creates the vector index and embeds/upserts the knowledge base
// =============================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pinecone } from '@pinecone-database/pinecone';
import { chunkKnowledgeBase } from './knowledge-search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'about-face-kb';
const NAMESPACE = 'knowledge-base';
const EMBEDDING_MODEL = process.env.PINECONE_EMBEDDING_MODEL || 'multilingual-e5-large';
const BATCH_SIZE = 50;

if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is required to seed vector search');
}

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function ensureIndex() {
    try {
        const index = await pinecone.describeIndex(INDEX_NAME);
        if (index.embed?.model !== EMBEDDING_MODEL) {
            throw new Error(`Index ${INDEX_NAME} uses ${index.embed?.model}; expected ${EMBEDDING_MODEL}`);
        }
        if (index.embed?.fieldMap?.text !== 'search_text') {
            console.log('updating integrated embedding field map to search_text...');
            return pinecone.configureIndex({
                name: INDEX_NAME,
                embed: { fieldMap: { text: 'search_text' } },
            });
        }
        return index;
    } catch (error) {
        const notFound = error.status === 404 || error.message.includes('404');
        if (!notFound) throw error;
    }

    console.log(`creating integrated vector index "${INDEX_NAME}" with ${EMBEDDING_MODEL}...`);
    return pinecone.createIndexForModel({
        name: INDEX_NAME,
        cloud: 'aws',
        region: 'us-east-1',
        embed: {
            model: EMBEDDING_MODEL,
            fieldMap: { text: 'search_text' },
        },
        waitUntilReady: true,
    });
}

async function waitForRecords(index, expectedCount) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const stats = await index.describeIndexStats();
        const count = stats.namespaces?.[NAMESPACE]?.recordCount || 0;
        if (count >= expectedCount) return count;
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timed out waiting for Pinecone to index the knowledge base');
}

async function main() {
    console.log('\n✦ about-face vector knowledge-base seeder\n');

    const kbPath = path.join(__dirname, 'about-face-knowledge-base.md');
    const markdown = fs.readFileSync(kbPath, 'utf8');
    const chunks = chunkKnowledgeBase(markdown);
    console.log(`loaded ${chunks.length} knowledge chunks`);

    const indexModel = await ensureIndex();
    const index = pinecone.index({ host: indexModel.host });
    const namespace = index.namespace(NAMESPACE);

    await namespace.deleteAll();
    console.log(`cleared namespace "${NAMESPACE}"`);

    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
        const batch = chunks.slice(start, start + BATCH_SIZE).map((chunk, offset) => ({
            id: `chunk-${start + offset}`,
            search_text: chunk.searchText,
            text: chunk.text,
            category: chunk.category,
            title: chunk.title,
        }));

        await namespace.upsertRecords({ records: batch });
        console.log(`upserted ${Math.min(start + BATCH_SIZE, chunks.length)}/${chunks.length}`);
    }

    const indexedCount = await waitForRecords(index, chunks.length);
    console.log(`\n✦ vector search ready with ${indexedCount} records\n`);
}

main().catch((error) => {
    console.error('seeding failed:', error.message);
    process.exit(1);
});
