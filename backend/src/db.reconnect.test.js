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

    it('detects ODBC idle / TCP drop messages', () => {
        assert.equal(
            isConnectionError(new Error('[Microsoft][ODBC Driver 17 for SQL Server]Communication link failure')),
            true,
        );
        assert.equal(
            isConnectionError(new Error('TCP Provider: An existing connection was forcibly closed by the remote host')),
            true,
        );
        assert.equal(
            isConnectionError({
                message: 'Failed request',
                originalError: { message: 'Physical connection is not usable', code: '08S01' },
            }),
            true,
        );
    });

    it('ignores normal application errors', () => {
        assert.equal(isConnectionError(new Error('อีเมล/เบอร์ หรือรหัสผ่านไม่ถูกต้อง')), false);
        assert.equal(isConnectionError(new Error('กรุณาเข้าสู่ระบบ')), false);
    });
});
