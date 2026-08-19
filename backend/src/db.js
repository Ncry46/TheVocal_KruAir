import dotenv from 'dotenv';
import sql from 'mssql/msnodesqlv8.js';

dotenv.config();

const driver = process.env.SQL_DRIVER || 'ODBC Driver 17 for SQL Server';
const server = process.env.SQL_SERVER || 'localhost';
const database = process.env.SQL_DATABASE || 'BD_AIR';
const user = process.env.SQL_USER;
const password = process.env.SQL_PASSWORD;
const encrypt = process.env.SQL_ENCRYPT || 'Yes';
const trustCert = process.env.SQL_TRUST_CERT || 'Yes';

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
    } else {
        parts.push('Trusted_Connection=Yes');
    }

    return `${parts.join(';')};`;
}

const config = {
    connectionString: buildConnectionString(),
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool;

export function getAuthMode() {
    return user ? 'SQL Authentication' : 'Windows Authentication';
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
