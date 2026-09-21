import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SQL_SERVER ||= 'localhost,1433';

describe('SQL query timeout recovery', () => {
    it('treats forced query timeouts as reconnectable connection errors', async () => {
        const { isConnectionError } = await import('./db.js');
        const err = new Error('SQL query timed out after 20000ms');
        err.code = 'ETIMEOUT';
        assert.equal(isConnectionError(err), true);
    });
});
