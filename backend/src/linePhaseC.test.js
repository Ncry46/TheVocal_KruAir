import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRichMenuBody } from './lineRichMenu.js';
import { getLiffConfig, liffUrl } from './lineLiff.js';
import { parsePostbackData } from './linePostback.js';
import { verifyLineSignature } from './lineWebhook.js';
import { flexPackageStatus } from './lineFlex.js';

describe('getLiffConfig', () => {
    it('requires LIFF_ID', () => {
        assert.equal(getLiffConfig({ LIFF_ID: '' }).configured, false);
        assert.equal(getLiffConfig({ LIFF_ID: '123-abc' }).configured, true);
    });
});

describe('liffUrl', () => {
    it('builds LIFF deep links', () => {
        const url = liffUrl('/app/booking', { LIFF_ID: '123-abc', FRONTEND_ORIGIN: 'http://localhost:5173' });
        assert.equal(url, 'https://liff.line.me/123-abc/app/booking');
    });
});

describe('buildRichMenuBody', () => {
    it('creates six tap areas', () => {
        const body = buildRichMenuBody({ LIFF_ID: 'abc', FRONTEND_ORIGIN: 'http://localhost:5173' });
        assert.equal(body.areas.length, 6);
        assert.equal(body.size.width, 2500);
        assert.equal(body.areas[0].action.type, 'uri');
        assert.equal(body.areas[1].action.data, 'MY_HOURS');
    });
});

describe('parsePostbackData', () => {
    it('splits action and argument', () => {
        assert.deepEqual(parsePostbackData('CONFIRM|L123'), { action: 'CONFIRM', arg: 'L123' });
        assert.deepEqual(parsePostbackData('CONTACT'), { action: 'CONTACT', arg: null });
    });
});

describe('verifyLineSignature', () => {
    it('validates HMAC signature', async () => {
        const secret = 'secret';
        const body = Buffer.from('{"events":[]}');
        const crypto = await import('node:crypto');
        const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');
        assert.equal(verifyLineSignature(body, signature, secret), true);
        assert.equal(verifyLineSignature(body, 'bad', secret), false);
    });
});

describe('flexPackageStatus', () => {
    it('renders flex message for active package', () => {
        const msg = flexPackageStatus({ name: 'Pro', hours: 20, used: 5, left: 15, expiresAt: '1 มี.ค. 2027' }, 'th');
        assert.equal(msg.type, 'flex');
        assert.match(msg.altText, /VOCALITY|แพ็กเกจ/);
    });
});
