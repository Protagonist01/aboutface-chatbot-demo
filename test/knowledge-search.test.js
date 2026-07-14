import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { chunkKnowledgeBase, searchLocalKnowledge } from '../knowledge-search.js';

const markdown = fs.readFileSync(new URL('../about-face-knowledge-base.md', import.meta.url), 'utf8');

test('FAQ answers are stored as atomic records', () => {
    const chunks = chunkKnowledgeBase(markdown);
    const bestSellerRecords = chunks.filter((chunk) => /best-selling product/i.test(chunk.text));

    assert.equal(bestSellerRecords.length, 1);
    assert.match(bestSellerRecords[0].text, /Matte Fluid Eye Paint/i);
    assert.doesNotMatch(bestSellerRecords[0].text, /How many foundation shades/i);
});

test('best sellers retrieves the exact FAQ answer first', () => {
    const results = searchLocalKnowledge('what are the best sellers?');

    assert.match(results[0].text, /Matte Fluid Eye Paint/i);
    assert.match(results[0].text, /fan[- ]favorite/i);
});

test('local retrieval covers policies and shade questions', () => {
    const shipping = searchLocalKnowledge('how long does shipping take?');
    const returns = searchLocalKnowledge('what is the return policy?');
    const shades = searchLocalKnowledge('how many foundation shades are available?');

    assert.ok(shipping.some((record) => /5-7 business days/i.test(record.text)));
    assert.ok(returns.some((record) => /30-day return policy/i.test(record.text)));
    assert.ok(shades.some((record) => /45 shades/i.test(record.text)));
});
