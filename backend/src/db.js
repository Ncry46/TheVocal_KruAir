import dotenv from 'dotenv';
import sql from 'mssql/msnodesqlv8.js';

dotenv.config();

const driver = process.env.SQL_DRIVER || 'ODBC Driver 17 for SQL Server';
const server = process.env.SQL_SERVER || 'localhost';
const database = process.env.SQL_DATABASE || 'TheVocal_KruAir';

const config = {
    connectionString: `Driver={${driver}};Server=${server};Database=${database};Trusted_Connection=Yes;TrustServerCertificate=Yes;`,
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },
};

let pool;

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
