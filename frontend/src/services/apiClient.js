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
        const fallback = response.status === 404
            ? `ไม่พบ API (${path})`
            : 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์';
        throw new Error(data.error || fallback);
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
    loginWithLiff(idToken) {
        return request('/auth/liff', { method: 'POST', body: JSON.stringify({ idToken }) });
    },
    publishLineRichMenu() {
        return request('/admin/line/rich-menu', { method: 'POST' });
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
    updateMeAvatar(avatar) {
        return request('/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatar }) });
    },
    getPackages() {
        return request('/packages');
    },
    getMyOffers() {
        return request('/me/offers');
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
    getDays(teacherId = '') {
        const query = teacherId ? `?teacherId=${encodeURIComponent(teacherId)}` : '';
        return request(`/days${query}`);
    },
    getSlots(day, teacherId = '') {
        const params = new URLSearchParams({ day });
        if (teacherId) {
            params.set('teacherId', String(teacherId));
        }
        return request(`/slots?${params.toString()}`);
    },
    getBookingSummary(day, time, teacherId = '', hours = 1) {
        const params = new URLSearchParams({ day, time, hours: String(hours || 1) });
        if (teacherId) {
            params.set('teacherId', String(teacherId));
        }
        return request(`/booking-summary?${params.toString()}`);
    },
    createBooking(day, time, mode = 'studio', teacherId = '', hours = 1) {
        return request('/bookings', {
            method: 'POST',
            body: JSON.stringify({
                day,
                time,
                mode,
                teacherId: teacherId || undefined,
                hours: Number(hours) || 1,
            }),
        });
    },
    getTeachers() {
        return request('/teachers');
    },
    createTeacherBooking(input) {
        return request('/teacher/bookings', { method: 'POST', body: JSON.stringify(input) });
    },
    getMyLessons() {
        return request('/me/lessons');
    },
    confirmLesson(id) {
        return request(`/me/lessons/${encodeURIComponent(id)}/confirm`, { method: 'POST' });
    },
    rejectLesson(id) {
        return request(`/me/lessons/${encodeURIComponent(id)}/reject`, { method: 'POST' });
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
    purchase(pkgId, voucherCode = '', offerId = '') {
        return request('/purchases', { method: 'POST', body: JSON.stringify({ pkgId, voucherCode, offerId }) });
    },
    getPurchase(refNo) {
        return request(`/purchases/${encodeURIComponent(refNo)}`);
    },
    notifyPurchasePaid(refNo, { note = '', slipDataUrl = '' } = {}) {
        return request(`/purchases/${encodeURIComponent(refNo)}/notify`, {
            method: 'POST',
            body: JSON.stringify({ note, slipDataUrl }),
        });
    },
    getPaymentConfig() {
        return request('/payment/config');
    },
    getPendingPayments() {
        return request('/teacher/payments/pending');
    },
    confirmPayment(refNo) {
        return request(`/teacher/payments/${encodeURIComponent(refNo)}/confirm`, { method: 'POST' });
    },
    rejectPayment(refNo, reason = '') {
        return request(`/teacher/payments/${encodeURIComponent(refNo)}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    },
    updatePaymentSettings(input) {
        return request('/admin/settings/payment', { method: 'PATCH', body: JSON.stringify(input) });
    },
    getMyPaymentLinks() {
        return request('/me/payment-links');
    },
    startPaymentLink(token) {
        return request(`/me/payment-links/${encodeURIComponent(token)}/start`, { method: 'POST' });
    },
    createPaymentLink(input) {
        return request('/teacher/payment-links', { method: 'POST', body: JSON.stringify(input) });
    },
    getTeacherPaymentLinks() {
        return request('/teacher/payment-links');
    },
    cancelPaymentLink(id) {
        return request(`/teacher/payment-links/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    },
    getTeacherToday() {
        return request('/teacher/today');
    },
    getStudentProfile(id) {
        return request(`/teacher/students/${encodeURIComponent(id)}`);
    },
    rescheduleTeacherLesson(bookingId, day, time) {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/move`, { method: 'POST', body: JSON.stringify({ day, time }) });
    },
    getGoogleCalendarStatus() {
        return request('/teacher/google/status');
    },
    getStudentGoogleCalendarStatus() {
        return request('/me/google/status');
    },
    async connectGoogleCalendar() {
        const data = await request('/teacher/google/connect');
        window.location.href = data.url;
    },
    async connectStudentGoogleCalendar() {
        const data = await request('/me/google/connect');
        window.location.href = data.url;
    },
    disconnectGoogleCalendar() {
        return request('/teacher/google', { method: 'DELETE' });
    },
    disconnectStudentGoogleCalendar() {
        return request('/me/google', { method: 'DELETE' });
    },
    getHomework() {
        return request('/me/homework');
    },
    uploadHomeworkAudio(classLogId, audio) {
        return request(`/me/homework/${classLogId}/audio`, { method: 'POST', body: JSON.stringify({ audio }) });
    },
    getTeacherHomeworkSubmissions() {
        return request('/teacher/homework/submissions');
    },
    getTeacherSignatures() {
        return request('/teacher/signatures');
    },
    getTeacherSignature(bookingId) {
        return request(`/teacher/signatures/${encodeURIComponent(bookingId)}`);
    },
    getPendingSignatures() {
        return request('/me/signatures/pending');
    },
    signLesson(bookingId, signature) {
        return request(`/me/signatures/${encodeURIComponent(bookingId)}`, { method: 'POST', body: JSON.stringify({ signature }) });
    },
    getCalendarIcsUrl() {
        return '/api/me/calendar.ics';
    },
    exportSalesCsv() {
        return '/api/admin/sales/export.csv';
    },
    async downloadSalesCsv(language = 'th') {
        const headers = { 'X-Lang': language === 'en' ? 'en' : 'th' };
        const token = getToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch('/api/admin/sales/export.csv', { headers });
        if (!response.ok) {
            throw new Error('Export failed');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const disposition = response.headers.get('Content-Disposition') || '';
        const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
        const filename = utfMatch
            ? decodeURIComponent(utfMatch[1])
            : (plainMatch?.[1] || (language === 'en' ? 'sales-report.csv' : 'รายงานยอดขาย.csv'));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(url);
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
    getTeacherSchedule(year, month, teacherId = '') {
        if (year && month) {
            const params = new URLSearchParams({ year: String(year), month: String(month) });
            if (teacherId) {
                params.set('teacherId', String(teacherId));
            }
            return request(`/teacher/schedule?${params.toString()}`);
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
    getAdminPackages() {
        return request('/admin/packages');
    },
    createPackage(input) {
        return request('/admin/packages', { method: 'POST', body: JSON.stringify(input) });
    },
    updatePackage(id, input) {
        return request(`/admin/packages/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
    },
    getStudentOffers(studentId) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/offers`);
    },
    createStudentOffer(studentId, input) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/offers`, { method: 'POST', body: JSON.stringify(input) });
    },
    getStudentRecurring(studentId) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/recurring`);
    },
    createStudentRecurring(studentId, input) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/recurring`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    },
    deleteStudentRecurring(studentId, ruleId) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/recurring/${encodeURIComponent(ruleId)}`, {
            method: 'DELETE',
        });
    },
    generateStudentRecurring(studentId, weeks = 4) {
        return request(`/teacher/students/${encodeURIComponent(studentId)}/recurring/generate`, {
            method: 'POST',
            body: JSON.stringify({ weeks }),
        });
    },
    cancelStudentOffer(publicId) {
        return request(`/teacher/offers/${encodeURIComponent(publicId)}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    },
    recordLesson(bookingId, outcome, note, feedbackAudioUrl = '') {
        return request(`/teacher/bookings/${encodeURIComponent(bookingId)}/log`, {
            method: 'POST',
            body: JSON.stringify({ outcome, note, feedbackAudioUrl }),
        });
    },
};
