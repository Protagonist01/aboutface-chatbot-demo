import assert from 'node:assert/strict';
import test from 'node:test';

import { parseModelReply } from '../rag-engine.js';

function completion(content, finishReason = 'stop') {
    return {
        choices: [{ finish_reason: finishReason, message: { content } }],
    };
}

test('accepts a complete structured customer reply', () => {
    const reply = parseModelReply(completion('{"reply":"matte fluid eye paint is the award-winning fan favorite."}'));
    assert.equal(reply, 'matte fluid eye paint is the award-winning fan favorite.');
});

test('accepts structured JSON wrapped in a markdown fence', () => {
    const reply = parseModelReply(completion('```json\n{"reply":"matte fluid eye paint is the best seller."}\n```'));
    assert.equal(reply, 'matte fluid eye paint is the best seller.');
});

test('rejects non-JSON output', () => {
    assert.throws(() => parseModelReply(completion('matte fluid eye paint')), /invalid JSON/i);
});

test('rejects internal planning text', () => {
    assert.throws(
        () => parseModelReply(completion('{"reply":"We need to answer using the provided context."}')),
        /internal planning/i,
    );
});

test('rejects a cut-off response', () => {
    assert.throws(
        () => parseModelReply(completion('{"reply":"unfinished"}', 'length')),
        /incomplete/i,
    );
});

test('rejects empty structured replies', () => {
    assert.throws(() => parseModelReply(completion('{"reply":""}')), /empty reply/i);
});
