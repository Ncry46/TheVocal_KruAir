import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, '..');

export default defineConfig({
    plugins: [react()],
    publicDir: path.resolve(repoRoot, 'assets'),
    resolve: {
        alias: {
            '@components': path.resolve(repoRoot, 'components'),
            '@app': path.resolve(dir, 'src'),
            '@data': path.resolve(repoRoot, 'data'),
        },
    },
    server: {
        host: true,
        port: 5173,
        strictPort: true,
        allowedHosts: 'all',
        proxy: {
            '/api': 'http://localhost:3001',
        },
        fs: {
            allow: [repoRoot],
        },
    },
    preview: {
        host: true,
        port: 5173,
        allowedHosts: 'all',
    },
});
