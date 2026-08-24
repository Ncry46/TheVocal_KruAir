import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env');
const loaded = dotenv.config({ path: envPath });
if (loaded.error) {
    console.warn(`No .env file at ${envPath}`);
}
else {
    console.log(`Loaded env from ${envPath}`);
}
console.log(`SQL_SERVER=${process.env.SQL_SERVER || '(not set)'}`);
