/**
 * LINE Official Account Messaging API (push).
 * Requires LINE_CHANNEL_ACCESS_TOKEN from LINE Developers → Messaging API channel.
 * Login channel and Messaging channel can share the same LINE Login provider if linked;
 * the student must have linked LINE (dbo.line_links) so we have their userId.
 */

const API_ROOT = 'https://api.line.me/v2/bot';
const PUSH_URL = `${API_ROOT}/message/push`;
const REPLY_URL = `${API_ROOT}/message/reply`;

export function getLineMessagingConfig(env = process.env) {
    const accessToken = String(env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
    return {
        configured: Boolean(accessToken),
        accessToken,
    };
}

export function isLineMessagingConfigured(env = process.env) {
    return getLineMessagingConfig(env).configured;
}

async function postLineMessages(url, payload, env = process.env) {
    const { configured, accessToken } = getLineMessagingConfig(env);
    if (!configured) {
        return { ok: false, skipped: true };
    }
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`LINE API failed (${response.status}): ${detail.slice(0, 200)}`);
    }
    return { ok: true };
}

export async function pushLineMessages(lineUserId, messages, env = process.env) {
    if (!lineUserId || !messages?.length) {
        return { ok: false, skipped: true };
    }
    return postLineMessages(PUSH_URL, { to: String(lineUserId), messages }, env);
}

export async function replyLineMessages(replyToken, messages, env = process.env) {
    if (!replyToken || !messages?.length) {
        return { ok: false, skipped: true };
    }
    return postLineMessages(REPLY_URL, { replyToken, messages }, env);
}

export async function pushLineText(lineUserId, text, env = process.env) {
    if (!lineUserId || !text) {
        return { ok: false, skipped: true };
    }
    const body = String(text).slice(0, 4900);
    return pushLineMessages(lineUserId, [{ type: 'text', text: body }], env);
}

export async function findLineUserIdForAppUser(userId, runQuery) {
    const result = await runQuery(
        `SELECT line_user_id FROM dbo.line_links WHERE user_id = @userId`,
        { userId },
    );
    return result.recordset[0]?.line_user_id || null;
}

export function formatLineNotifyMessage(title, body) {
    const t = String(title || '').trim();
    const b = String(body || '').trim();
    if (t && b) {
        return `${t}\n${b}`;
    }
    return t || b;
}
