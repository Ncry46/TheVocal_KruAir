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
            react: path.resolve(dir, 'node_modules/react'),
            'react-dom': path.resolve(dir, 'node_modules/react-dom'),
            'react-router-dom': path.resolve(dir, 'node_modules/react-router-dom'),
            recharts: path.resolve(dir, 'node_modules/recharts/es6/index.js'),
        },
        dedupe: ['react', 'react-dom', 'react-router-dom', 'recharts'],
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
