import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOP_K = 5;

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
    SUSTAINABILITY: 'sustainability',
    'FREQUENTLY ASKED': 'faq',
    'COMPETITIVE POSITIONING': 'brand',
    'PRODUCT INNOVATION': 'products',
    'CUSTOMER TESTIMONIALS': 'reviews',
    TROUBLESHOOTING: 'support',
    'CONTACT & SUPPORT': 'support',
    'BRAND VOICE': 'brand',
};

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'about', 'can', 'do', 'does', 'for', 'from', 'how',
    'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'the', 'their', 'to',
    'what', 'when', 'where', 'which', 'with', 'you', 'your',
]);

let indexedChunks = null;

function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9$]+/g, ' ')
        .trim();
}

function tokenize(text) {
    return normalize(text)
        .split(/\s+/)
        .filter((term) => term.length > 1 && !STOP_WORDS.has(term));
}

function categoryFor(section) {
    const header = section.match(/^## \d+\.\s+([^\n]+)/)?.[1]?.toUpperCase() || '';
    for (const [label, category] of Object.entries(CATEGORY_MAP)) {
        if (header.includes(label)) return category;
    }
    return 'general';
}

export function chunkKnowledgeBase(markdown) {
    const chunks = [];
    const sections = markdown.split(/(?=^## \d+\.\s+)/m);

    for (const section of sections) {
        if (!section.trim()) continue;
        const category = categoryFor(section);
        const subsections = section.split(/(?=^###\s+)/m);

        for (const subsection of subsections) {
            const text = subsection.trim();
            if (text.length <= 50) continue;

            const parts = text.length > 2000
                ? text.split(/(?=^####\s+)/m)
                : [text];

            for (const part of parts) {
                const trimmed = part.trim();
                if (trimmed.length > 50) {
                    chunks.push({ text: trimmed.slice(0, 2200), category });
                }
            }
        }
    }

    return chunks;
}

function loadIndex() {
    if (indexedChunks) return indexedChunks;

    const kbPath = path.join(__dirname, 'about-face-knowledge-base.md');
    const chunks = chunkKnowledgeBase(fs.readFileSync(kbPath, 'utf8'));
    const documentFrequency = new Map();

    indexedChunks = chunks.map((chunk) => {
        const terms = tokenize(chunk.text);
        const termCounts = new Map();
        for (const term of terms) {
            termCounts.set(term, (termCounts.get(term) || 0) + 1);
        }
        for (const term of termCounts.keys()) {
            documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
        }
        return { ...chunk, normalized: normalize(chunk.text), terms, termCounts };
    });

    indexedChunks.documentFrequency = documentFrequency;
    indexedChunks.averageLength = indexedChunks.reduce((sum, chunk) => sum + chunk.terms.length, 0) / indexedChunks.length;
    return indexedChunks;
}

function inferCategory(queryTerms) {
    const query = new Set(queryTerms);
    if (query.has('shipping') || query.has('delivery')) return 'shipping';
    if (query.has('return') || query.has('returns') || query.has('refund') || query.has('exchange')) return 'returns';
    if (query.has('shade') || query.has('shades') || query.has('undertone')) return 'shades';
    if (query.has('ingredient') || query.has('ingredients') || query.has('vegan') || query.has('cruelty')) return 'ingredients';
    if (query.has('price') || query.has('cost') || query.has('much')) return 'pricing';
    if (query.has('buy') || query.has('store') || query.has('ulta')) return 'shopping';
    return null;
}

export function searchLocalKnowledge(query, topK = TOP_K) {
    const index = loadIndex();
    const queryTerms = [...new Set(tokenize(query))];
    const normalizedQuery = normalize(query);
    const category = inferCategory(queryTerms);
    const totalDocuments = index.length;

    return index
        .map((chunk) => {
            let score = normalizedQuery.length > 3 && chunk.normalized.includes(normalizedQuery) ? 5 : 0;

            for (const term of queryTerms) {
                const frequency = chunk.termCounts.get(term) || 0;
                if (!frequency) continue;

                const documentsWithTerm = index.documentFrequency.get(term) || 0;
                const idf = Math.log(1 + (totalDocuments - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5));
                const lengthWeight = frequency + 1.2 * (0.25 + 0.75 * (chunk.terms.length / index.averageLength));
                score += idf * ((frequency * 2.2) / lengthWeight);
            }

            if (category && chunk.category === category) score += 3;
            return { ...chunk, rawScore: score };
        })
        .filter((chunk) => chunk.rawScore > 0)
        .sort((a, b) => b.rawScore - a.rawScore)
        .slice(0, topK)
        .map((chunk) => ({
            text: chunk.text,
            category: chunk.category,
            score: Math.min(0.99, chunk.rawScore / (chunk.rawScore + 4)),
        }));
}
