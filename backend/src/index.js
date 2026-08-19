import cors from 'cors';
import express from 'express';
import { registerRoutes } from './routes.js';
import { getAuthMode, getPool } from './db.js';
import { ensureEnrollmentSchema } from './store.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const origin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin, credentials: true }));
app.use(express.json());
app.use((req, _res, next) => {
    const raw = String(req.headers['x-lang'] || req.query.lang || '').toLowerCase();
    req.lang = raw.startsWith('en') ? 'en' : 'th';
    next();
});

app.get('/api/health', async (_req, res) => {
    await getPool();
    res.json({ ok: true, database: process.env.SQL_DATABASE || 'BD_AIR' });
});

registerRoutes(app);

app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    const status = /เข้าสู่ระบบ|เซสชัน/.test(message) ? 401 : 400;
    res.status(status).json({ error: message });
});

const server = app.listen(port, () => {
    console.log(`KruAir API listening on http://localhost:${port}`);
});

getPool()
    .then(async () => {
        await ensureEnrollmentSchema();
        console.log(`Connected to SQL Server with ${getAuthMode()}`);
    })
    .catch((err) => {
        console.error('SQL Server connection failed:', err.message);
        server.close();
        process.exit(1);
    });
