import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        port: 5173,
        allowedHosts: 'all',
        fs: {
            allow: ['..'],
        },
    },
    preview: {
        host: true,
        port: 5173,
        allowedHosts: 'all',
    },
});
