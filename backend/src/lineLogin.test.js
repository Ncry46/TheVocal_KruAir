import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAuthorizeUrl, getLineConfig, lineSignupDefaults, safeNextPath } from './lineLogin.js';

describe('getLineConfig', () => {
    it('is unconfigured until both channel id and secret are set', () => {
        const config = getLineConfig({
            LINE_CHANNEL_ID: '123',
            LINE_CHANNEL_SECRET: '',
            FRONTEND_ORIGIN: 'https://kruair.thanvasupos.com',
        });
        assert.equal(config.configured, false);
    });

    it('is configured when id and secret are present', () => {
        const config = getLineConfig({
            LINE_CHANNEL_ID: '123',
            LINE_CHANNEL_SECRET: 'secret',
        });
        assert.equal(config.configured, true);
        assert.equal(config.callbackUrl, 'http://localhost:3001/api/auth/line/callback');
        assert.equal(config.frontendOrigin, 'http://localhost:5173');
    });
});

describe('buildAuthorizeUrl', () => {
    it('asks LINE for profile and openid with an encoded scope', () => {
        const url = buildAuthorizeUrl(
            {
                channelId: '123',
                callbackUrl: 'https://kruair.thanvasupos.com/api/auth/line/callback',
                scopes: 'profile openid',
            },
            { state: 'abc', nonce: 'n1' },
        );
        assert.match(url, /^https:\/\/access\.line\.me\/oauth2\/v2\.1\/authorize\?/);
        assert.match(url, /client_id=123/);
        assert.match(url, /scope=profile%20openid/);
    });
});

describe('lineSignupDefaults', () => {
    it('uses LINE display name and generates an email', () => {
        const defaults = lineSignupDefaults({
            sub: 'Uabc123',
            name: 'สมชาย ใจดี',
        });
        assert.equal(defaults.name, 'สมชาย ใจดี');
        assert.equal(defaults.nickname, 'สมชาย');
        assert.equal(defaults.nameEn, '');
        assert.equal(defaults.email, 'line.Uabc123@kruair.local');
    });

    it('prefills English names when LINE name is Latin', () => {
        const defaults = lineSignupDefaults({
            sub: 'U1',
            name: 'Mint Jaidee',
            email: 'mint@email.com',
        });
        assert.equal(defaults.nameEn, 'Mint Jaidee');
        assert.equal(defaults.nicknameEn, 'Mint');
        assert.equal(defaults.email, 'mint@email.com');
    });
});

describe('safeNextPath', () => {
    it('allows in-app paths only', () => {
        assert.equal(safeNextPath('/app/profile'), '/app/profile');
        assert.equal(safeNextPath('https://evil.example'), '/app');
        assert.equal(safeNextPath('//evil.example'), '/app');
    });
});
