import { getToken } from '@app/services/apiClient';

function extensionFromMime(mime) {
    const value = String(mime || '').toLowerCase();
    if (value.includes('png')) {
        return 'png';
    }
    if (value.includes('webp')) {
        return 'webp';
    }
    if (value.includes('gif')) {
        return 'gif';
    }
    return 'jpg';
}

/** Fetch an authenticated slip image and trigger a browser download. */
export async function downloadAuthenticatedSlip(fetchPath, { filenameBase = 'slip' } = {}) {
    const token = getToken();
    const response = await fetch(`/api${fetchPath}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
        throw new Error('download failed');
    }
    const blob = await response.blob();
    const ext = extensionFromMime(blob.type);
    const objectUrl = URL.createObjectURL(blob);
    try {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `${filenameBase}.${ext}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
    finally {
        URL.revokeObjectURL(objectUrl);
    }
}
