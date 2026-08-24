import { api } from './apiClient';

export async function beginLineLogin(intent = 'login') {
    const data = await api.startLineLogin(intent);
    if (!data?.url) {
        throw new Error('ไม่สามารถเปิดหน้า LINE Login ได้');
    }
    window.location.assign(data.url);
}
