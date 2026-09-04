import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPromptPayPayload } from './promptPay.js';

describe('buildPromptPayPayload', () => {
    it('builds payload for phone number', () => {
        const payload = buildPromptPayPayload('0812345678', 2500);
        assert.match(payload, /^000201/);
        assert.match(payload, /6304[0-9A-F]{4}$/);
    });

    it('returns null without target', () => {
        assert.equal(buildPromptPayPayload('', 100), null);
    });
});
