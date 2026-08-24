import './loadEnv.js';
import mssql from 'mssql';

const driver = process.env.SQL_DRIVER || 'ODBC Driver 17 for SQL Server';
const server = String(process.env.SQL_SERVER || '').trim();
const database = process.env.SQL_DATABASE || 'BD_AIR';
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;
const encrypt = process.env.SQL_ENCRYPT || 'Yes';
const trustCert = process.env.SQL_TRUST_CERT || 'Yes';
const client = String(process.env.SQL_CLIENT || '').toLowerCase();
const useNative = client === 'msnodesqlv8'
    || (client !== 'tedious' && process.platform === 'win32');

if (!server) {
    throw new Error('SQL_SERVER is not set. Deploy image must include backend/.env or -e SQL_SERVER=host,port');
}

const sql = useNative
    ? (await import('mssql/msnodesqlv8.js')).default
    : mssql;

function flagYes(value) {
    return /^(y|yes|true|1)$/i.test(String(value ?? '').trim());
}

function parseSqlServer(raw) {
    const value = String(raw || '').trim();
    if (!value) {
        throw new Error('SQL_SERVER is empty');
    }
    const comma = value.lastIndexOf(',');
    if (comma > 0) {
        const host = value.slice(0, comma).trim();
        const port = Number(value.slice(comma + 1).trim());
        return { host, port: Number.isInteger(port) ? port : 1433 };
    }
    return { host: value, port: 1433 };
}

function buildConnectionString() {
    const parts = [
        `Driver={${driver}}`,
        `Server=${server}`,
        `Database=${database}`,
        `Encrypt=${encrypt}`,
        `TrustServerCertificate=${trustCert}`,
    ];
    if (user) {
        parts.push(`Uid=${user}`);
        parts.push(`Pwd=${password || ''}`);
    }
    else {
        parts.push('Trusted_Connection=Yes');
    }
    return `${parts.join(';')};`;
}

function buildConfig() {
    if (useNative) {
        return {
            connectionString: buildConnectionString(),
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000,
            },
        };
    }
    const parsed = parseSqlServer(server);
    return {
        server: parsed.host,
        port: parsed.port,
        database,
        user,
        password,
        options: {
            encrypt: flagYes(encrypt),
            trustServerCertificate: flagYes(trustCert),
            enableArithAbort: true,
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000,
        },
    };
}

const config = buildConfig();
let pool;

export function getAuthMode() {
    if (useNative && !user) {
        return 'Windows Authentication';
    }
    return useNative ? 'SQL Authentication (ODBC)' : 'SQL Authentication';
}

export async function getPool() {
    if (pool?.connected) {
        return pool;
    }
    pool = await sql.connect(config);
    return pool;
}

export async function closePool() {
    if (!pool) {
        return;
    }
    await pool.close();
    pool = null;
}

export { sql };
