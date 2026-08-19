import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendPort = 3001;
const frontendPort = 5173;

function isPortOpen(port) {
    return new Promise((resolve) => {
        const socket = createConnection({ port, host: '127.0.0.1' }, () => {
            socket.end();
            resolve(true);
        });
        socket.on('error', () => resolve(false));
    });
}

if (await isPortOpen(frontendPort)) {
    console.error(`Port ${frontendPort} is already in use. Open http://localhost:${frontendPort} or press Ctrl+C in the other terminal first.`);
    process.exit(1);
}

if (await isPortOpen(backendPort)) {
    console.error(`Port ${backendPort} is already in use. Press Ctrl+C in the other terminal first.`);
    process.exit(1);
}

const children = [
    spawn(process.execPath, ['src/index.js'], {
        cwd: join(root, 'backend'),
        stdio: 'inherit',
        env: process.env,
    }),
    spawn(process.execPath, ['node_modules/vite/bin/vite.js'], {
        cwd: join(root, 'frontend'),
        stdio: 'inherit',
        env: process.env,
    }),
];

let shuttingDown = false;

function shutdown(code = 0) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    for (const child of children) {
        if (!child.killed) {
            child.kill();
        }
    }
    process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

for (const child of children) {
    child.on('exit', (code) => {
        if (shuttingDown) {
            return;
        }
        if (code && code !== 0) {
            shutdown(code);
        }
    });
}
