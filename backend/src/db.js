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
        'Connection Timeout=30',
        'Login Timeout=30',
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
    const poolOptions = {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    };
    if (useNative) {
        return {
            connectionString: buildConnectionString(),
            connectionTimeout: 30000,
            requestTimeout: 30000,
            pool: poolOptions,
        };
    }
    const parsed = parseSqlServer(server);
    return {
        server: parsed.host,
        port: parsed.port,
        database,
        user,
        password,
        connectionTimeout: 30000,
        requestTimeout: 30000,
        options: {
            encrypt: flagYes(encrypt),
            trustServerCertificate: flagYes(trustCert),
            enableArithAbort: true,
        },
        pool: poolOptions,
    };
}

const config = buildConfig();
let pool;
let connecting;

export function getAuthMode() {
    if (useNative && !user) {
        return 'Windows Authentication';
    }
    return useNative ? 'SQL Authentication (ODBC)' : 'SQL Authentication';
}

export function isConnectionError(err) {
    const message = String(err?.message || err || '').toLowerCase();
    const code = String(err?.code || '').toUpperCase();
    return [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ESOCKET',
        'ENOTOPEN',
        'ETIMEOUT',
        'ELOGIN',
    ].includes(code)
        || message.includes('connection is closed')
        || message.includes('connection lost')
        || message.includes('connection is not open')
        || message.includes('not connected')
        || message.includes('socket hang up')
        || message.includes('timeout')
        || message.includes('broken pipe')
        || message.includes('server closed the connection')
        || message.includes('unable to connect')
        || message.includes('login failed');
}

function attachPoolHandlers(nextPool) {
    nextPool.on('error', (err) => {
        console.error('SQL pool error:', err.message);
        if (pool === nextPool) {
            pool = null;
        }
    });
}

export async function resetPool() {
    const current = pool;
    pool = null;
    connecting = null;
    if (!current) {
        return;
    }
    try {
        await current.close();
    }
    catch {
        /* already closed */
    }
}

export async function getPool() {
    if (pool?.connected) {
        return pool;
    }
    if (connecting) {
        return connecting;
    }
    connecting = (async () => {
        if (pool && !pool.connected) {
            await resetPool();
        }
        const nextPool = await new sql.ConnectionPool(config).connect();
        attachPoolHandlers(nextPool);
        pool = nextPool;
        return nextPool;
    })();
    try {
        return await connecting;
    }
    finally {
        connecting = null;
    }
}

export async function closePool() {
    await resetPool();
}

export { sql };
