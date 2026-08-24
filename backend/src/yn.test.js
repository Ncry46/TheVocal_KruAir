import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isYes } from './yn.js';

describe('isYes', () => {
    it('treats Y, active, and boolean true as enabled', () => {
        assert.equal(isYes('Y'), true);
        assert.equal(isYes('y'), true);
        assert.equal(isYes('active'), true);
        assert.equal(isYes(true), true);
        assert.equal(isYes(1), true);
    });

    it('treats N, disabled, and empty as not enabled', () => {
        assert.equal(isYes('N'), false);
        assert.equal(isYes('disabled'), false);
        assert.equal(isYes(''), false);
        assert.equal(isYes(null), false);
        assert.equal(isYes(false), false);
    });

    it('ignores padding from CHAR columns', () => {
        assert.equal(isYes('Y '), true);
        assert.equal(isYes(Buffer.from('Y')), true);
    });
});
