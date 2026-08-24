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
    try {
        headers['X-Lang'] = localStorage.getItem('kruaer-language') === 'en' ? 'en' : 'th';
    }
    catch {
        headers['X-Lang'] = 'th';
    }
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
    startLineLogin(intent) {
        return request('/auth/line/start', { method: 'POST', body: JSON.stringify({ intent }) });
    },
    getLineStatus() {
        return request('/auth/line/status');
    },
    getLinePending(ticket) {
        return request(`/auth/line/pending?ticket=${encodeURIComponent(ticket)}`);
    },
    async completeLineLogin(token) {
        setToken(token);
        return request('/me');
    },
    logout() {
        setToken(null);
    },
    setLanguage(language) {
        const next = language === 'en' ? 'en' : 'th';
        return request('/me/language', { method: 'PUT', body: JSON.stringify({ language: next }) });
    },
    getMe() {
        return request('/me');
    },
    updateMe(input) {
        return request('/me', { method: 'PATCH', body: JSON.stringify(input) });
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
    createBooking(day, time, mode = 'studio') {
        return request('/bookings', { method: 'POST', body: JSON.stringify({ day, time, mode }) });
    },
    getMyLessons() {
        return request('/me/lessons');
    },
    confirmLesson(id) {
        return request(`/me/lessons/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
    },
    cancelLesson(id) {
        return request(`/me/lessons/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
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
    createVoucher(input) {
        return request('/admin/vouchers', { method: 'POST', body: JSON.stringify(input) });
    },
    setVoucherStatus(code, active) {
        return request(`/admin/vouchers/${encodeURIComponent(code)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active }),
        });
    },
    getUsers() {
        return request('/admin/users');
    },
    createUser(input) {
        return request('/admin/users', { method: 'POST', body: JSON.stringify(input) });
    },
    setUserStatus(id, status) {
        return request(`/admin/users/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
        });
    },
    getTeacherSchedule(year, month) {
        if (year && month) {
            return request(`/teacher/schedule?year=${year}&month=${month}`);
        }
        return request('/teacher/schedule');
    },
    createTeacherSlot(day, time) {
        return request('/teacher/slots', { method: 'POST', body: JSON.stringify({ day, time }) });
    },
    setTeacherSlot(id, action) {
        return request(`/teacher/slots/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ action }),
        });
    },
    bulkCloseSlots(from, to) {
        return request('/teacher/slots/bulk-close', { method: 'POST', body: JSON.stringify({ from, to }) });
    },
    remindLesson(bookingId) {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/remind`, { method: 'POST' });
    },
    cancelTeacherLesson(bookingId) {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST' });
    },
    getSettings() {
        return request('/admin/settings');
    },
    recordLesson(bookingId, outcome, note, feedbackAudioUrl = '') {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/log`, {
            method: 'POST',
            body: JSON.stringify({ outcome, note, feedbackAudioUrl }),
        });
    },
};
