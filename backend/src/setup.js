import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, getAuthMode, getPool } from './db.js';

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../../sql/schema.sql');

function shouldSkipBatch(sqlText) {
    const normalized = sqlText.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return true;
    }
    if (/CREATE\s+DATABASE/i.test(normalized)) {
        return true;
    }
    if (/^USE\s+/i.test(normalized)) {
        return true;
    }
    return false;
}

async function setup() {
    const pool = await getPool();
    const database = process.env.SQL_DATABASE || 'BD_AIR';
    console.log(`Applying schema to ${database} (${getAuthMode()})`);

    const schema = readFileSync(schemaPath, 'utf8');
    const batches = schema.split(/^\s*GO\s*$/gim);

    for (const batch of batches) {
        const sqlText = batch.trim();
        if (shouldSkipBatch(sqlText)) {
            continue;
        }
        await pool.request().batch(sqlText);
    }

    const tables = await pool.request().query(
        `SELECT name FROM sys.tables WHERE type = 'U' ORDER BY name`,
    );
    console.log(`Schema ready: ${tables.recordset.map((row) => row.name).join(', ')}`);
    await closePool();
}

setup().catch(async (err) => {
    console.error(err);
    await closePool().catch(() => {});
    process.exit(1);
});
