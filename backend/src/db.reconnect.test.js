import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SQL_SERVER ||= 'localhost,1433';
const { isConnectionError } = await import('./db.js');

describe('isConnectionError', () => {
    it('detects common dropped-connection codes', () => {
        assert.equal(isConnectionError({ code: 'ECONNRESET', message: 'reset' }), true);
        assert.equal(isConnectionError({ code: 'ETIMEOUT', message: 'timeout' }), true);
        assert.equal(isConnectionError(new Error('Connection is closed.')), true);
        assert.equal(isConnectionError(new Error('socket hang up')), true);
    });

    it('ignores normal application errors', () => {
        assert.equal(isConnectionError(new Error('อีเมล/เบอร์ หรือรหัสผ่านไม่ถูกต้อง')), false);
        assert.equal(isConnectionError(new Error('กรุณาเข้าสู่ระบบ')), false);
    });
});
