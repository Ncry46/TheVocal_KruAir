import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import { registerRoutes } from './routes.js';
import { getAuthMode, getPool } from './db.js';
import { runSchoolJobs } from './jobs.js';
import { ensureEnrollmentSchema } from './store.js';

function corsOrigin(reqOrigin, callback) {
    const configured = process.env.FRONTEND_ORIGIN || 'https://kruair.thanvasupos.com';
    if (!reqOrigin) {
        callback(null, true);
        return;
    }
    if (reqOrigin === configured) {
        callback(null, reqOrigin);
        return;
    }
    try {
        const host = new URL(reqOrigin).hostname;
        const allowed = host === 'kruair.thanvasupos.com'
            || host.endsWith('.trycloudflare.com')
            || host.endsWith('.ngrok-free.app')
            || host.endsWith('.ngrok.app')
            || host.endsWith('.ngrok.io');
        callback(null, allowed ? reqOrigin : configured);
    }
    catch {
        callback(null, configured);
    }
}

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors({ origin: corsOrigin, credentials: true }));
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

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public');
if (existsSync(join(publicDir, 'index.html'))) {
    app.use(express.static(publicDir));
    app.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            next();
            return;
        }
        if (req.path.startsWith('/api')) {
            next();
            return;
        }
        res.sendFile(join(publicDir, 'index.html'));
    });
}

app.use((err, _req, res, _next) => {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
    const status = /เข้าสู่ระบบ|เซสชัน/.test(message) ? 401 : 400;
    res.status(status).json({ error: message });
});

const server = app.listen(port, '0.0.0.0', () => {
    console.log(`KruAir API listening on http://0.0.0.0:${port}`);
});

getPool()
    .then(async () => {
        await ensureEnrollmentSchema();
        console.log(`Connected to SQL Server with ${getAuthMode()}`);
        const tick = () => runSchoolJobs().then((result) => {
            if (result.expired || result.reminded) {
                console.log('school jobs', result);
            }
        }).catch((err) => {
            console.error('school jobs failed:', err.message);
        });
        tick();
        setInterval(tick, 5 * 60 * 1000);
    })
    .catch((err) => {
        console.error('SQL Server connection failed:', err.message);
        server.close();
        process.exit(1);
    });
