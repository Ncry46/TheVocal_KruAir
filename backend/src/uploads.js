import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const UPLOAD_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../uploads');
const HOMEWORK_DIR = join(UPLOAD_ROOT, 'homework');
const SLIPS_DIR = join(UPLOAD_ROOT, 'slips');

const EXT_BY_MIME = {
    webm: 'webm',
    mpeg: 'mp3',
    mp3: 'mp3',
    wav: 'wav',
    ogg: 'ogg',
    mp4: 'm4a',
    'x-m4a': 'm4a',
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    webp: 'webp',
};

export function saveHomeworkAudio(dataUrl) {
    const value = String(dataUrl ?? '').trim();
    const match = value.match(/^data:audio\/([\w.+-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('ไฟล์เสียงไม่ถูกต้อง');
    }
    const mime = match[1].toLowerCase();
    const ext = EXT_BY_MIME[mime] || mime.replace(/[^a-z0-9]/gi, '') || 'webm';
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length < 256) {
        throw new Error('ไฟล์เสียงสั้นเกินไป');
    }
    if (buffer.length > 12 * 1024 * 1024) {
        throw new Error('ไฟล์เสียงใหญ่เกิน 12 MB');
    }
    mkdirSync(HOMEWORK_DIR, { recursive: true });
    const filename = `${randomBytes(16).toString('hex')}.${ext}`;
    writeFileSync(join(HOMEWORK_DIR, filename), buffer);
    return `/uploads/homework/${filename}`;
}

export function savePaymentSlip(dataUrl) {
    const value = String(dataUrl ?? '').trim();
    const match = value.match(/^data:image\/([\w.+-]+);base64,(.+)$/);
    if (!match) {
        throw new Error('รูปสลิปไม่ถูกต้อง — ใช้ไฟล์ JPG หรือ PNG');
    }
    const mime = match[1].toLowerCase();
    const ext = EXT_BY_MIME[mime] || 'jpg';
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length < 64) {
        throw new Error('ไฟล์รูปสลิปไม่ถูกต้อง');
    }
    if (buffer.length > 5 * 1024 * 1024) {
        throw new Error('รูปสลิปใหญ่เกิน 5 MB');
    }
    mkdirSync(SLIPS_DIR, { recursive: true });
    const filename = `${randomBytes(16).toString('hex')}.${ext}`;
    writeFileSync(join(SLIPS_DIR, filename), buffer);
    return `/uploads/slips/${filename}`;
}

export function resolvePaymentSlipFile(storedUrl) {
    const value = String(storedUrl || '').trim();
    if (!value) {
        return null;
    }
    const name = basename(value);
    if (!name || name.includes('..')) {
        return null;
    }
    const full = join(SLIPS_DIR, name);
    if (!existsSync(full)) {
        return null;
    }
    return full;
}

export { UPLOAD_ROOT };
