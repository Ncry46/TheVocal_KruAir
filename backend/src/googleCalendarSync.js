import jwt from 'jsonwebtoken';
import { buildGoogleCalendarUrl } from './googleCalendar.js';
import { query } from './store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const REDIRECT_URI = String(process.env.GOOGLE_REDIRECT_URI || '').trim()
    || `${String(process.env.FRONTEND_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')}/api/teacher/google/callback`;
const STUDENT_REMINDER_MINUTES = 24 * 60;

export function isGoogleCalendarConfigured() {
    return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function buildGoogleOAuthState(userId, returnTo = 'teacher') {
    return jwt.sign({ purpose: 'google-calendar', userId, returnTo }, JWT_SECRET, { expiresIn: '15m' });
}

export function parseGoogleOAuthState(state) {
    const payload = jwt.verify(String(state), JWT_SECRET);
    if (payload?.purpose !== 'google-calendar' || !payload.userId) {
        throw new Error('Invalid OAuth state');
    }
    return {
        userId: Number(payload.userId),
        returnTo: payload.returnTo === 'student' ? 'student' : 'teacher',
    };
}

export function buildGoogleConnectUrl(userId, returnTo = 'teacher') {
    if (!isGoogleCalendarConfigured()) {
        throw new Error('Google Calendar ยังไม่ได้ตั้งค่าในระบบ');
    }
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        state: buildGoogleOAuthState(userId, returnTo),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Google token exchange failed');
    }
    return data;
}

export async function saveGoogleConnection(userId, tokenData) {
    const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
        : null;
    await query(
        `MERGE dbo.google_calendar_connections AS target
         USING (SELECT @userId AS user_id) AS source
         ON target.user_id = source.user_id
         WHEN MATCHED THEN
             UPDATE SET access_token = @accessToken,
                        refresh_token = COALESCE(@refreshToken, target.refresh_token),
                        expires_at = @expiresAt,
                        connected_at = SYSUTCDATETIME()
         WHEN NOT MATCHED THEN
             INSERT (user_id, access_token, refresh_token, expires_at)
             VALUES (@userId, @accessToken, @refreshToken, @expiresAt);`,
        {
            userId,
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token || null,
            expiresAt,
        },
    );
}

export async function completeGoogleOAuth(code, userId) {
    const tokenData = await exchangeCode(code);
    await saveGoogleConnection(userId, tokenData);
    return getGoogleConnection(userId);
}

export async function getGoogleConnection(userId) {
    const result = await query(
        `SELECT user_id, calendar_id, connected_at, expires_at,
                CASE WHEN refresh_token IS NOT NULL OR access_token IS NOT NULL THEN 1 ELSE 0 END AS connected
         FROM dbo.google_calendar_connections
         WHERE user_id = @userId`,
        { userId },
    );
    const row = result.recordset[0];
    if (!row) {
        return { connected: false };
    }
    return {
        connected: Boolean(row.connected),
        calendarId: row.calendar_id || 'primary',
        connectedAt: row.connected_at,
        expiresAt: row.expires_at,
    };
}

export async function disconnectGoogleCalendar(userId) {
    await query(`DELETE FROM dbo.google_calendar_connections WHERE user_id = @userId`, { userId });
}

async function refreshAccessToken(userId, refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error_description || data.error || 'Google token refresh failed');
    }
    await saveGoogleConnection(userId, { ...data, refresh_token: refreshToken });
    return data.access_token;
}

async function getValidAccessToken(userId) {
    const result = await query(
        `SELECT access_token, refresh_token, expires_at FROM dbo.google_calendar_connections WHERE user_id = @userId`,
        { userId },
    );
    const row = result.recordset[0];
    if (!row?.access_token) {
        return null;
    }
    const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
    if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
        return row.access_token;
    }
    if (!row.refresh_token) {
        return row.access_token;
    }
    return refreshAccessToken(userId, row.refresh_token);
}

function eventPayloadFromBooking(row, { forStudent = false } = {}) {
    const title = forStudent
        ? 'คอร์สร้องกับครูแอร์'
        : (row.topic || row.topic_en || 'คอร์สร้อง');
    const student = row.nickname || row.student_name || '';
    const teacher = row.teacher_nickname || row.teacher_name || 'ครูแอร์';
    const details = forStudent
        ? `เรียนกับ ${teacher} · VOCALITY ACADEMY BY KRU AIR`
        : `เรียนกับ ${student || 'นักเรียน'} · VOCALITY ACADEMY`;
    const url = buildGoogleCalendarUrl({
        title: forStudent ? 'คอร์สร้องกับครูแอร์' : title,
        startDate: row.slot_iso,
        startTime: row.slot_hhmm,
        durationHours: Number(row.duration_hours) || 1,
        details,
    });
    const [year, month, day] = String(row.slot_iso).split('-').map(Number);
    const [hour, minute] = String(row.slot_hhmm).split(':').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
    const end = new Date(start.getTime() + (Number(row.duration_hours) || 1) * 60 * 60 * 1000);
    const payload = {
        summary: title,
        description: `${details}\n${url}`,
        location: 'VOCALITY ACADEMY BY KRU AIR',
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Bangkok' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Bangkok' },
    };
    if (forStudent) {
        payload.reminders = {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: STUDENT_REMINDER_MINUTES },
                { method: 'popup', minutes: 120 },
            ],
        };
    }
    return payload;
}

async function loadBookingRow(bookingRowId) {
    const found = await query(
        `SELECT b.id, b.public_id, b.google_event_id, b.google_student_event_id, b.topic, b.topic_en,
                b.duration_hours, b.status, b.user_id,
                u.nickname, u.name,
                t.nickname AS teacher_nickname, t.name AS teacher_name,
                CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                s.teacher_id
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         LEFT JOIN dbo.users u ON u.id = b.user_id
         LEFT JOIN dbo.users t ON t.id = s.teacher_id
         WHERE b.id = @id`,
        { id: bookingRowId },
    );
    return found.recordset[0] ?? null;
}

async function syncBookingToUserCalendar(bookingRowId, ownerUserId, { eventColumn, forStudent }) {
    if (!isGoogleCalendarConfigured()) {
        return null;
    }
    const accessToken = await getValidAccessToken(ownerUserId);
    if (!accessToken) {
        return null;
    }
    const row = await loadBookingRow(bookingRowId);
    if (!row) {
        return null;
    }
    const eventId = row[eventColumn];
    const conn = await query(`SELECT calendar_id FROM dbo.google_calendar_connections WHERE user_id = @userId`, { userId: ownerUserId });
    const calendarId = encodeURIComponent(conn.recordset[0]?.calendar_id || 'primary');

    if (['cancelled', 'done', 'no_show'].includes(row.status)) {
        if (!eventId) {
            return null;
        }
        await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        await query(`UPDATE dbo.bookings SET ${eventColumn} = NULL WHERE id = @id`, { id: row.id });
        return null;
    }

    const body = eventPayloadFromBooking(row, { forStudent });
    const method = eventId ? 'PATCH' : 'POST';
    const url = eventId
        ? `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`
        : `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
        console.error('Google Calendar sync failed:', data.error?.message || response.status);
        return null;
    }
    if (data.id && data.id !== eventId) {
        await query(`UPDATE dbo.bookings SET ${eventColumn} = @eventId WHERE id = @id`, {
            id: row.id,
            eventId: data.id,
        });
    }
    return data.id;
}

export async function syncBookingToGoogleCalendar(bookingRowId, teacherId) {
    return syncBookingToUserCalendar(bookingRowId, teacherId, {
        eventColumn: 'google_event_id',
        forStudent: false,
    });
}

export async function syncBookingToStudentGoogleCalendar(bookingRowId, studentUserId) {
    return syncBookingToUserCalendar(bookingRowId, studentUserId, {
        eventColumn: 'google_student_event_id',
        forStudent: true,
    });
}

export async function syncAllBookingCalendars(bookingRowId, teacherId, studentUserId) {
    const tasks = [syncBookingToGoogleCalendar(bookingRowId, teacherId)];
    if (studentUserId) {
        tasks.push(syncBookingToStudentGoogleCalendar(bookingRowId, studentUserId));
    }
    await Promise.allSettled(tasks);
}

export async function syncUpcomingStudentBookings(studentUserId) {
    const result = await query(
        `SELECT id FROM dbo.bookings
         WHERE user_id = @userId AND status IN (N'pending', N'confirmed', N'moved')`,
        { userId: studentUserId },
    );
    for (const row of result.recordset) {
        await syncBookingToStudentGoogleCalendar(row.id, studentUserId);
    }
}
