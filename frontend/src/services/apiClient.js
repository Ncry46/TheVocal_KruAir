const TOKEN_KEY = 'kruaer-token';

export function getToken() {
    try {
        return localStorage.getItem(TOKEN_KEY);
    }
    catch {
        return null;
    }
}

export function setToken(token) {
    try {
        if (token) {
            localStorage.setItem(TOKEN_KEY, token);
        }
        else {
            localStorage.removeItem(TOKEN_KEY);
        }
    }
    catch {
        /* ignore quota/private-mode errors */
    }
}

async function request(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
    };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`/api${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
    }
    return data;
}

export const api = {
    async login(input) {
        const data = await request('/auth/login', { method: 'POST', body: JSON.stringify(input) });
        setToken(data.token);
        return data.user;
    },
    async register(input) {
        const data = await request('/auth/register', { method: 'POST', body: JSON.stringify(input) });
        setToken(data.token);
        return data.user;
    },
    logout() {
        setToken(null);
    },
    getPackages() {
        return request('/packages');
    },
    getPackageStatus() {
        return request('/me/package-status');
    },
    getHistory() {
        return request('/me/history');
    },
    getReceipts() {
        return request('/me/receipts');
    },
    getDays() {
        return request('/days');
    },
    getSlots(day) {
        return request(`/slots?day=${encodeURIComponent(day)}`);
    },
    getBookingSummary(day, time) {
        return request(`/booking-summary?day=${encodeURIComponent(day)}&time=${encodeURIComponent(time)}`);
    },
    createBooking(day, time) {
        return request('/bookings', { method: 'POST', body: JSON.stringify({ day, time }) });
    },
    getMyLessons() {
        return request('/me/lessons');
    },
    confirmLesson(id) {
        return request(`/me/lessons/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
    },
    requestMoveLesson(id, day, time) {
        return request(`/me/lessons/${encodeURIComponent(id)}/move`, { method: 'POST', body: JSON.stringify({ day, time }) });
    },
    getNotifications() {
        return request('/notifications');
    },
    markNotificationsRead() {
        return request('/notifications/read', { method: 'POST' });
    },
    async validateVoucher(code, price) {
        const data = await request('/vouchers/validate', { method: 'POST', body: JSON.stringify({ code, price }) });
        return data.discount;
    },
    purchase(pkgId, voucherCode, method) {
        return request('/purchases', { method: 'POST', body: JSON.stringify({ pkgId, voucherCode, method }) });
    },
    getMoveRequests() {
        return request('/admin/move-requests');
    },
    decideMove(id, approve) {
        return request(`/admin/move-requests/${encodeURIComponent(id)}/decide`, { method: 'POST', body: JSON.stringify({ approve }) });
    },
    getStudents() {
        return request('/admin/students');
    },
    getSalesReport() {
        return request('/admin/sales');
    },
    getVouchers() {
        return request('/admin/vouchers');
    },
    createVoucher(code) {
        return request('/admin/vouchers', { method: 'POST', body: JSON.stringify({ code }) });
    },
    getTeacherSchedule() {
        return request('/teacher/schedule');
    },
    recordLesson(bookingId, outcome, note) {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/log`, {
            method: 'POST',
            body: JSON.stringify({ outcome, note }),
        });
    },
};
