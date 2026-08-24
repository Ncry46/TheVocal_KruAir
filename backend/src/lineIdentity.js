export function decideLineCallback({ intent, currentUserId, existingByLine, existingByEmail, email }) {
    const lineUser = existingByLine ? { id: Number(existingByLine.id) } : null;
    const emailUser = existingByEmail ? { id: Number(existingByEmail.id) } : null;

    if (intent === 'link') {
        if (!currentUserId) {
            return { action: 'error', code: 'failed' };
        }
        if (lineUser && lineUser.id !== Number(currentUserId)) {
            return { action: 'error', code: 'taken' };
        }
        return { action: 'link', userId: Number(currentUserId) };
    }

    if (lineUser) {
        return { action: 'login', userId: lineUser.id };
    }
    if (email && emailUser) {
        return { action: 'link_and_login', userId: emailUser.id };
    }
    return { action: 'register' };
}

export function lineProfileFromIdToken(payload = {}) {
    const lineUserId = String(payload.sub || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();
    return {
        lineUserId,
        email: email || null,
        name: String(payload.name || '').trim() || null,
        picture: String(payload.picture || '').trim() || null,
    };
}
