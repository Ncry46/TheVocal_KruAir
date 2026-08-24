import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideLineCallback, lineProfileFromIdToken } from './lineIdentity.js';

describe('decideLineCallback', () => {
    it('logs in when this LINE user is already linked', () => {
        const result = decideLineCallback({
            intent: 'login',
            existingByLine: { id: 7 },
        });
        assert.deepEqual(result, { action: 'login', userId: 7 });
    });

    it('links and logs in when LINE email matches an existing account', () => {
        const result = decideLineCallback({
            intent: 'login',
            email: 'mint@email.com',
            existingByEmail: { id: 3 },
        });
        assert.deepEqual(result, { action: 'link_and_login', userId: 3 });
    });

    it('sends new LINE users to registration', () => {
        const result = decideLineCallback({ intent: 'register' });
        assert.deepEqual(result, { action: 'register' });
    });

    it('links LINE to the signed-in user', () => {
        const result = decideLineCallback({
            intent: 'link',
            currentUserId: 12,
        });
        assert.deepEqual(result, { action: 'link', userId: 12 });
    });

    it('rejects linking a LINE account that belongs to someone else', () => {
        const result = decideLineCallback({
            intent: 'link',
            currentUserId: 12,
            existingByLine: { id: 99 },
        });
        assert.deepEqual(result, { action: 'error', code: 'taken' });
    });
});

describe('lineProfileFromIdToken', () => {
    it('reads LINE user id, email, and profile fields', () => {
        const profile = lineProfileFromIdToken({
            sub: 'Uabc',
            email: 'Mint@Email.com',
            name: 'Mint',
            picture: 'https://example.com/a.png',
        });
        assert.equal(profile.lineUserId, 'Uabc');
        assert.equal(profile.email, 'mint@email.com');
        assert.equal(profile.name, 'Mint');
        assert.equal(profile.picture, 'https://example.com/a.png');
    });
});
