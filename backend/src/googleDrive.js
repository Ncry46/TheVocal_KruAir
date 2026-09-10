import { getValidAccessToken, isGoogleCalendarConfigured } from './googleCalendarSync.js';
import { query } from './store.js';

const ROOT_FOLDER_NAME = 'VOCALITY Homework';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export function safeDriveFolderName(name) {
    const cleaned = String(name || 'student')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80);
    return cleaned || 'student';
}

async function driveFetch(accessToken, url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(options.headers || {}),
        },
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    }
    catch {
        data = { raw: text };
    }
    if (!response.ok) {
        const message = data?.error?.message || data?.error_description || text || `Drive API ${response.status}`;
        throw new Error(message);
    }
    return data;
}

async function findChildFolder(accessToken, parentId, name) {
    const escaped = String(name).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const q = [
        `name='${escaped}'`,
        'mimeType=\'application/vnd.google-apps.folder\'',
        'trashed=false',
        parentId ? `'${parentId}' in parents` : '\'root\' in parents',
    ].join(' and ');
    const params = new URLSearchParams({
        q,
        spaces: 'drive',
        fields: 'files(id,name)',
        pageSize: '1',
    });
    const data = await driveFetch(accessToken, `https://www.googleapis.com/drive/v3/files?${params}`);
    return data?.files?.[0]?.id || null;
}

async function createFolder(accessToken, name, parentId = null) {
    const body = {
        name,
        mimeType: FOLDER_MIME,
    };
    if (parentId) {
        body.parents = [parentId];
    }
    const data = await driveFetch(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id,name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return data.id;
}

async function ensureFolder(accessToken, name, parentId = null) {
    const existing = await findChildFolder(accessToken, parentId, name);
    if (existing) {
        return existing;
    }
    return createFolder(accessToken, name, parentId);
}

async function loadDriveRootFolderId(teacherId) {
    const result = await query(
        `SELECT drive_root_folder_id FROM dbo.google_calendar_connections WHERE user_id = @userId`,
        { userId: teacherId },
    );
    return result.recordset[0]?.drive_root_folder_id || null;
}

async function saveDriveRootFolderId(teacherId, folderId) {
    await query(
        `UPDATE dbo.google_calendar_connections
         SET drive_root_folder_id = @folderId
         WHERE user_id = @userId`,
        { userId: teacherId, folderId },
    );
}

/**
 * Upload homework audio into teacher Drive:
 * VOCALITY Homework / {student} / {date}-hw-{classLogId}.{ext}
 * Returns { fileId, webViewLink } or null if teacher not connected / Drive unavailable.
 */
export async function uploadHomeworkAudioToTeacherDrive({
    teacherId,
    studentNickname,
    classLogId,
    slotIso,
    buffer,
    contentType,
    ext,
}) {
    if (!isGoogleCalendarConfigured() || !teacherId) {
        return null;
    }
    const accessToken = await getValidAccessToken(teacherId);
    if (!accessToken) {
        return null;
    }

    let rootId = await loadDriveRootFolderId(teacherId);
    try {
        if (!rootId) {
            rootId = await ensureFolder(accessToken, ROOT_FOLDER_NAME, null);
            await saveDriveRootFolderId(teacherId, rootId);
        }
        const studentFolderName = safeDriveFolderName(studentNickname);
        const studentFolderId = await ensureFolder(accessToken, studentFolderName, rootId);
        const day = String(slotIso || '').slice(0, 10) || 'unknown-date';
        const filename = `${day}-hw-${classLogId}.${ext}`;

        const metadata = {
            name: filename,
            parents: [studentFolderId],
        };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([buffer], { type: contentType || `audio/${ext}` }));

        const uploaded = await driveFetch(
            accessToken,
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
            { method: 'POST', body: form },
        );

        const webViewLink = uploaded.webViewLink
            || (uploaded.id ? `https://drive.google.com/file/d/${uploaded.id}/view` : null);
        if (!webViewLink) {
            return null;
        }
        return { fileId: uploaded.id, webViewLink };
    }
    catch (err) {
        console.error('Google Drive homework upload failed:', err instanceof Error ? err.message : err);
        return null;
    }
}
