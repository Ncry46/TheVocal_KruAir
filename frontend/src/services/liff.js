import liff from '@line/liff';
import { api, getToken, setToken } from './apiClient';

let initPromise = null;
let liffState = {
    configured: false,
    inClient: false,
    ready: false,
};

export function getLiffState() {
    return { ...liffState };
}

export async function initLiff() {
    if (initPromise) {
        return initPromise;
    }
    initPromise = (async () => {
        const status = await api.getLineStatus().catch(() => null);
        if (!status?.liffId) {
            liffState = { configured: false, inClient: false, ready: false };
            return liffState;
        }
        await liff.init({ liffId: status.liffId });
        const inClient = liff.isInClient();
        liffState = { configured: true, inClient, ready: true, liffId: status.liffId };
        if (inClient) {
            document.documentElement.dataset.liff = '1';
        }
        return liffState;
    })();
    return initPromise;
}

export async function ensureLiffAppSession({ onNeedRegister, onLoggedIn } = {}) {
    const state = await initLiff();
    if (!state.configured || !state.inClient) {
        return state;
    }
    if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return { ...state, redirecting: true };
    }
    if (!getToken()) {
        const idToken = liff.getIDToken();
        if (!idToken) {
            return state;
        }
        const data = await api.loginWithLiff(idToken);
        if (data.needRegister) {
            onNeedRegister?.(data.ticket);
            return { ...state, needRegister: true, ticket: data.ticket };
        }
        setToken(data.token);
        onLoggedIn?.(data.user);
        return { ...state, user: data.user };
    }
    return state;
}

export function closeLiffWindow() {
    if (liff.isInClient()) {
        liff.closeWindow();
    }
}
