# Kru Air Singing School — Dev Server Run Doc

## Reproduce Uncommitted Artifacts
- Dependencies already installed in `webapp/node_modules/` — no action needed.
- No `.env.local` required; the app runs with mock data in localStorage.

## Run the Dev Server
```bash
cd webapp
npx vite --port 5173 --host
```
- Framework: Vite 5 + React 18 + TypeScript
- Default port: 5173
- The dev server serves the SPA with hot reload and proper asset resolution.
