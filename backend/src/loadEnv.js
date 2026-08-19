import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({
    path: join(dirname(fileURLToPath(import.meta.url)), '../.env'),
});
