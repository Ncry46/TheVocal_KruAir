import { getLineMessagingConfig } from './lineMessaging.js';
import { getLiffConfig, liffUrl } from './lineLiff.js';

const API_BASE = 'https://api.line.me/v2/bot';

function richMenuAreas(liffId, frontendOrigin) {
    const uri = (path) => (liffId ? liffUrl(path) : `${frontendOrigin}${path}`);
    const w = 833;
    const h = 843;
    return [
        {
            bounds: { x: 0, y: 0, width: w, height: h },
            action: { type: 'uri', label: 'จองเวลาเรียน', uri: uri('/app/booking') },
        },
        {
            bounds: { x: w, y: 0, width: w, height: h },
            action: { type: 'postback', label: 'แพ็กเกจของฉัน', data: 'MY_HOURS', displayText: 'ดูแพ็กเกจของฉัน' },
        },
        {
            bounds: { x: w * 2, y: 0, width: w, height: h },
            action: { type: 'postback', label: 'ประวัติการเรียน', data: 'MY_HISTORY', displayText: 'ดูประวัติการเรียน' },
        },
        {
            bounds: { x: 0, y: h, width: w, height: h },
            action: { type: 'uri', label: 'โปรไฟล์', uri: uri('/app/profile') },
        },
        {
            bounds: { x: w, y: h, width: w, height: h },
            action: { type: 'uri', label: 'ซื้อแพ็กเกจ', uri: uri('/app/packages') },
        },
        {
            bounds: { x: w * 2, y: h, width: w, height: h },
            action: { type: 'postback', label: 'ติดต่อครูแอร์', data: 'CONTACT', displayText: 'ติดต่อครูแอร์' },
        },
    ];
}

export function buildRichMenuBody(env = process.env) {
    const { liffId, frontendOrigin } = getLiffConfig(env);
    return {
        size: { width: 2500, height: 1686 },
        selected: true,
        name: 'VOCALITY Student Menu',
        chatBarText: 'เมนูนักเรียน',
        areas: richMenuAreas(liffId, frontendOrigin),
    };
}

async function lineApi(path, { method = 'GET', body, contentType = 'application/json' } = {}, env = process.env) {
    const { configured, accessToken } = getLineMessagingConfig(env);
    if (!configured) {
        throw new Error('ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN');
    }
    const headers = { Authorization: `Bearer ${accessToken}` };
    let payload;
    if (body != null) {
        if (contentType === 'application/json') {
            headers['Content-Type'] = 'application/json';
            payload = JSON.stringify(body);
        }
        else {
            payload = body;
        }
    }
    const response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`LINE API ${response.status}: ${detail.slice(0, 300)}`);
    }
    if (response.status === 204) {
        return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

export async function createRichMenu(env = process.env) {
    return lineApi('/richmenu', { method: 'POST', body: buildRichMenuBody(env) }, env);
}

export async function uploadRichMenuImage(menuId, imageBuffer, env = process.env) {
    const { accessToken } = getLineMessagingConfig(env);
    const response = await fetch(`${API_BASE}/richmenu/${menuId}/content`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'image/png',
        },
        body: imageBuffer,
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`LINE rich menu image upload failed (${response.status}): ${detail.slice(0, 200)}`);
    }
}

export async function setDefaultRichMenu(menuId, env = process.env) {
    await lineApi(`/user/all/richmenu/${menuId}`, { method: 'POST' }, env);
}

export async function linkRichMenuToUser(lineUserId, menuId, env = process.env) {
    await lineApi(`/user/${lineUserId}/richmenu/${menuId}`, { method: 'POST' }, env);
}

async function loadRichMenuImage(env = process.env) {
    const url = String(env.LINE_RICH_MENU_IMAGE_URL || '').trim();
    if (!url) {
        throw new Error('ตั้งค่า LINE_RICH_MENU_IMAGE_URL (PNG 2500×1686 px) ใน backend/.env ก่อน');
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`โหลดรูป Rich Menu ไม่สำเร็จ (${response.status})`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 100) {
        throw new Error('ไฟล์รูป Rich Menu ไม่ถูกต้อง');
    }
    return buffer;
}

export async function publishRichMenu(env = process.env) {
    const created = await createRichMenu(env);
    const menuId = created?.richMenuId;
    if (!menuId) {
        throw new Error('LINE ไม่ส่ง richMenuId กลับมา');
    }
    const image = await loadRichMenuImage(env);
    await uploadRichMenuImage(menuId, image, env);
    await setDefaultRichMenu(menuId, env);
    return { menuId, linked: 'all' };
}
