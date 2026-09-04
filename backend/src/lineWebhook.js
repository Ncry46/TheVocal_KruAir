import crypto from 'node:crypto';
import { getLineConfig } from './lineLogin.js';
import { isLineMessagingConfigured } from './lineMessaging.js';
import { handleLinePostback } from './linePostback.js';
import { pushLineText } from './lineMessaging.js';

export function verifyLineSignature(rawBody, signature, channelSecret) {
    if (!signature || !channelSecret || !rawBody) {
        return false;
    }
    const hash = crypto.createHmac('sha256', channelSecret).update(rawBody).digest('base64');
    return hash === signature;
}

export async function dispatchLineEvent(event, lang = 'th') {
    const lineUserId = event.source?.userId;
    if (!lineUserId) {
        return;
    }

    if (event.type === 'postback') {
        await handleLinePostback({
            lineUserId,
            data: event.postback?.data,
            replyToken: event.replyToken,
            lang,
        });
        return;
    }

    if (event.type === 'follow') {
        const welcome = lang === 'en'
            ? 'Welcome to VOCALITY ACADEMY BY KRU AIR 🎤\nUse the menu below to book lessons, check your package, or contact us.'
            : 'ยินดีต้อนรับสู่ VOCALITY ACADEMY BY KRU AIR 🎤\nใช้เมนูด้านล่างจองเรียน ดูแพ็กเกจ หรือติดต่อครูแอร์ได้เลย';
        await pushLineText(lineUserId, welcome);
    }
}

export async function handleLineWebhookPayload(rawBody, signature, env = process.env) {
    const { channelSecret } = getLineConfig(env);
    if (!isLineMessagingConfigured(env)) {
        throw new Error('LINE Messaging API is not configured');
    }
    if (!verifyLineSignature(rawBody, signature, channelSecret)) {
        throw new Error('Invalid LINE signature');
    }
    const body = JSON.parse(rawBody.toString('utf8'));
    for (const event of body.events ?? []) {
        try {
            await dispatchLineEvent(event);
        }
        catch (err) {
            console.error('LINE event failed:', err instanceof Error ? err.message : err);
        }
    }
    return { ok: true, events: body.events?.length ?? 0 };
}

export function createLineWebhookHandler(env = process.env) {
    return async (req, res) => {
        try {
            const signature = String(req.headers['x-line-signature'] || '');
            const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
            await handleLineWebhookPayload(rawBody, signature, env);
            res.status(200).json({ ok: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'LINE webhook error';
            const status = /signature/i.test(message) ? 401 : 400;
            console.error('LINE webhook rejected:', message);
            res.status(status).json({ error: message });
        }
    };
}
