import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { asyncHandler, optionalAuth, requireAuth, requireRole, signUser, toProfile } from './auth.js';
import {
    createLineAuthorizeUrl,
    frontendRedirectUrl,
    isLineConfigured,
    lineSignupDefaults,
    loadLineProfile,
    resolveLineCallbackDecision,
    signLinePending,
    verifyLinePending,
} from './lineLogin.js';
import { chipLabel, educationEn, formatDate, genresEn, lessonTimeRange, localizePackage, monthYear, paymentStatus, pick, requiredPersonNames, resolveLang, slotLabel, slotStatus } from './lang.js';
import { defaultAvatar } from './avatar.js';
import { parseIsoDate, plusOneHour, toIsoDate } from './dates.js';
import { canStudentCancel, hoursUntilSlot, CANCEL_MIN_HOURS, SLOT_TIMES } from './bookingPolicy.js';
import { jobState } from './jobs.js';
import {
    activePackage,
    addNotification,
    assertDayIso,
    assertStudentPhone,
    bulkCloseTeacherSlots,
    cancelLessonBooking,
    createLessonBooking,
    createPackagePurchase,
    createTeacherSlot,
    defaultTeacherId,
    discountForVoucher,
    enrollStudent,
    ensureTeacherAvailability,
    findSlot,
    findUserById,
    findUserByLineUserId,
    findUserByLogin,
    linkLineAccount,
    isYes,
    listTeacherMonthSlots,
    mapMoveRequest,
    mapNotification,
    normalizePhone,
    notifySlotTeacher,
    packageStatusFromRow,
    query,
    setTeacherSlotStatus,
    studentLabel,
    toYn,
} from './store.js';

function publicId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function homePathForRole(role) {
    if (role === 'teacher') {
        return '/teacher';
    }
    if (role === 'admin') {
        return '/admin';
    }
    return '/app';
}

function profilePathForRole(role) {
    if (role === 'teacher') {
        return '/teacher/profile';
    }
    if (role === 'admin') {
        return '/admin/profile';
    }
    return '/app/profile';
}

async function teacherScopeId(req) {
    if (req.user.role === 'teacher') {
        return req.user.id;
    }
    return defaultTeacherId();
}

async function loadLessonForUser(lessonPublicId, userId) {
    const found = await query(
        `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
         FROM dbo.bookings b
         JOIN dbo.teacher_availability s ON s.id = b.slot_id
         WHERE b.public_id = @id AND b.user_id = @userId`,
        { id: lessonPublicId, userId },
    );
    const lesson = found.recordset[0];
    if (!lesson) {
        throw new Error('ไม่พบคลาสที่เลือก');
    }
    return lesson;
}

function mapAdminVoucher(row, lang) {
    const percentLabel = `% ${Number(row.value)}%`;
    const maxLabel = row.max_discount == null
        ? percentLabel
        : `${percentLabel} (${lang === 'en' ? 'max' : 'สูงสุด'} ${Number(row.max_discount).toLocaleString()})`;
    return {
        code: row.code,
        type: row.type === 'percent'
            ? maxLabel
            : `${lang === 'en' ? 'THB' : 'บาท'} ${Number(row.value).toLocaleString()}`,
        expires: row.valid_to ? formatDate(new Date(row.valid_to), lang) : '—',
        used: `${row.used_count} / ${row.max_uses ?? '—'}`,
        state: isYes(row.is_active) ? 'active' : 'draft',
    };
}

export function registerRoutes(app) {
    app.post('/api/auth/login', asyncHandler(async (req, res) => {
        const id = String(req.body?.id ?? '').trim();
        const password = String(req.body?.password ?? '');
        if (!id || !password.trim()) {
            throw new Error('กรุณากรอกอีเมล/เบอร์โทร และรหัสผ่าน');
        }
        const user = await findUserByLogin(id);
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            throw new Error('อีเมล/เบอร์ หรือรหัสผ่านไม่ถูกต้อง');
        }
        if (!isYes(user.status)) {
            throw new Error('บัญชีนี้ถูกระงับ กรุณาติดต่อแอดมิน');
        }
        const language = resolveLang(req);
        await query(`UPDATE dbo.users SET language = @language, updated_at = SYSUTCDATETIME() WHERE id = @id`, {
            language,
            id: user.id,
        });
        user.language = language;
        res.json({ token: signUser(user), user: toProfile(user) });
    }));

    app.post('/api/auth/register', asyncHandler(async (req, res) => {
        const input = req.body ?? {};
        if (!input.consent) {
            throw new Error('กรุณายอมรับนโยบาย PDPA');
        }
        let pending = null;
        if (input.lineTicket) {
            pending = verifyLinePending(input.lineTicket);
            const taken = await findUserByLineUserId(pending.sub);
            if (taken) {
                throw new Error('บัญชี LINE นี้ถูกผูกแล้ว — เข้าสู่ระบบด้วย LINE ได้เลย');
            }
        }
        const viaLine = Boolean(pending);
        if (!viaLine && (!input.age || !input.education || !input.genres?.length || !input.reason)) {
            throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง');
        }
        const defaults = viaLine ? lineSignupDefaults(pending) : null;
        const names = requiredPersonNames(viaLine
            ? {
                name: defaults.name,
                nickname: defaults.nickname,
                nameEn: input.nameEn,
                nicknameEn: input.nicknameEn,
            }
            : input);
        const email = String((viaLine ? defaults.email : input.email) ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
        }
        const phone = assertStudentPhone(input.phone);
        const emergencyContact = String(input.emergencyContact ?? '').trim().slice(0, 120);
        if (!viaLine && String(input.password ?? '').length < 6) {
            throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        }
        const existingEmail = await findUserByLogin(email);
        if (existingEmail) {
            throw new Error('อีเมลนี้ลงทะเบียนแล้ว — เข้าสู่ระบบเลย');
        }
        const existingPhone = await findUserByLogin(phone);
        if (existingPhone) {
            throw new Error('เบอร์โทรนี้ลงทะเบียนแล้ว — เข้าสู่ระบบเลย');
        }
        const password = viaLine ? randomBytes(24).toString('hex') : String(input.password);
        const hash = await bcrypt.hash(password, 10);
        const language = resolveLang(req);
        const avatar = pending?.picture || defaultAvatar('student', email);
        const genreList = viaLine
            ? []
            : (Array.isArray(input.genres) ? input.genres.map(String) : []);
        const education = viaLine ? null : String(input.education);
        const reason = viaLine ? 'สมัครผ่าน LINE' : String(input.reason);
        const enrolled = await enrollStudent({
            enrollmentId: publicId('enr-'),
            email,
            phone,
            emergencyContact: emergencyContact || null,
            hash,
            name: names.name,
            nameEn: names.nameEn,
            nickname: names.nickname,
            nicknameEn: names.nicknameEn,
            age: viaLine ? null : Number(input.age),
            education,
            educationEn: education ? educationEn(education) : null,
            genres: genreList.length ? JSON.stringify(genreList) : null,
            genresEn: genreList.length ? JSON.stringify(genresEn(genreList)) : null,
            reason,
            reasonEn: viaLine ? 'Signed up with LINE' : (language === 'en' ? reason : null),
            language,
            avatar,
        });
        let user = enrolled.user;
        if (pending) {
            user = await linkLineAccount(enrolled.user.id, {
                lineUserId: pending.sub,
                name: pending.name,
                picture: pending.picture,
            });
        }
        res.json({
            token: signUser(user),
            user: toProfile(user),
            saved: {
                enrollmentId: enrolled.enrollmentId,
                hoursGranted: enrolled.hoursGranted,
            },
        });
    }));

    app.get('/api/auth/line/status', (_req, res) => {
        res.json({ configured: isLineConfigured() });
    });

    app.post('/api/auth/line/start', optionalAuth, asyncHandler(async (req, res) => {
        const intent = String(req.body?.intent || 'login');
        if (intent === 'link' && !req.user) {
            res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนเชื่อม LINE' });
            return;
        }
        const url = createLineAuthorizeUrl({
            intent,
            userId: intent === 'link' ? req.user.id : null,
            role: intent === 'link' ? req.user.role : null,
        });
        res.json({ url });
    }));

    app.get('/api/auth/line/pending', asyncHandler(async (req, res) => {
        const pending = verifyLinePending(req.query.ticket);
        res.json({
            name: pending.name || null,
            picture: pending.picture || null,
            email: pending.email || null,
        });
    }));

    app.get('/api/auth/line/callback', async (req, res) => {
        const send = (path, params) => res.redirect(frontendRedirectUrl(path, params));
        try {
            if (req.query.error) {
                send('/login', { lineError: req.query.error === 'access_denied' ? 'denied' : 'failed' });
                return;
            }
            const code = String(req.query.code || '');
            const state = String(req.query.state || '');
            if (!code || !state) {
                send('/login', { lineError: 'failed' });
                return;
            }
            const { session, profile } = await loadLineProfile({ code, state });
            const existingByLine = await findUserByLineUserId(profile.lineUserId);
            const existingByEmail = profile.email ? await findUserByLogin(profile.email) : null;
            const decision = resolveLineCallbackDecision({
                session,
                profile,
                existingByLine,
                existingByEmail,
            });
            if (decision.action === 'error') {
                send('/login', { lineError: decision.code });
                return;
            }
            if (decision.action === 'register') {
                send('/register', { lineTicket: signLinePending(profile) });
                return;
            }
            if (decision.action === 'link' || decision.action === 'link_and_login') {
                await linkLineAccount(decision.userId, profile);
            }
            const user = await findUserById(decision.userId);
            if (!user || !isYes(user.status)) {
                send('/login', { lineError: 'inactive' });
                return;
            }
            const language = resolveLang(req);
            await query(`UPDATE dbo.users SET language = @language, updated_at = SYSUTCDATETIME() WHERE id = @id`, {
                language,
                id: user.id,
            });
            const next = decision.action === 'link'
                ? `${profilePathForRole(user.role)}?line=linked`
                : homePathForRole(user.role);
            send('/login', { token: signUser(user), next });
        }
        catch (err) {
            console.error('LINE callback failed:', err instanceof Error ? err.message : err);
            send('/login', { lineError: 'failed' });
        }
    });

    app.get('/api/packages', asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(`SELECT id, name, name_en, hours, price, note, note_en, tag, tag_en, tone FROM dbo.packages WHERE is_active = N'Y' ORDER BY hours`);
        res.json(result.recordset.map((row) => localizePackage(row, lang)));
    }));

    app.put('/api/me/language', requireAuth, asyncHandler(async (req, res) => {
        const language = String(req.body?.language ?? '').toLowerCase() === 'en' ? 'en' : 'th';
        await query(`UPDATE dbo.users SET language = @language, updated_at = SYSUTCDATETIME() WHERE id = @id`, {
            language,
            id: req.user.id,
        });
        const user = await findUserById(req.user.id);
        res.json({ language, user: toProfile(user) });
    }));

    app.get('/api/me', requireAuth, asyncHandler(async (req, res) => {
        const user = await findUserById(req.user.id);
        res.json(toProfile(user));
    }));

    app.patch('/api/me', requireAuth, asyncHandler(async (req, res) => {
        const input = req.body ?? {};
        const names = requiredPersonNames(input);
        const ageRaw = input.age;
        const age = ageRaw == null || ageRaw === '' ? null : Number(ageRaw);
        if (age != null && (!Number.isInteger(age) || age < 5 || age > 90)) {
            throw new Error('กรุณากรอกอายุให้ถูกต้อง');
        }
        const rawPhone = String(input.phone ?? '').trim();
        const phone = rawPhone ? assertStudentPhone(rawPhone) : null;
        if (phone) {
            const existingPhone = await findUserByLogin(phone);
            if (existingPhone && Number(existingPhone.id) !== Number(req.user.id)) {
                throw new Error('เบอร์โทรนี้มีในระบบแล้ว');
            }
        }
        const emergencyContact = String(input.emergencyContact ?? '').trim().slice(0, 120) || null;
        const education = String(input.education ?? '').trim() || null;
        const genreList = Array.isArray(input.genres) ? input.genres.map(String).filter(Boolean) : [];
        const reason = String(input.reason ?? '').trim() || null;
        const language = resolveLang(req);
        await query(
            `UPDATE dbo.users
             SET name = @name, name_en = @nameEn, nickname = @nickname, nickname_en = @nicknameEn,
                 age = @age, phone = @phone,
                 emergency_contact = @emergencyContact, education = @education, education_en = @educationEn,
                 genres = @genres, genres_en = @genresEn, reason = @reason, reason_en = @reasonEn,
                 updated_at = SYSUTCDATETIME()
             WHERE id = @id`,
            {
                id: req.user.id,
                name: names.name,
                nameEn: names.nameEn,
                nickname: names.nickname,
                nicknameEn: names.nicknameEn,
                age,
                phone,
                emergencyContact,
                education,
                educationEn: education ? educationEn(education) : null,
                genres: genreList.length ? JSON.stringify(genreList) : null,
                genresEn: genreList.length ? JSON.stringify(genresEn(genreList)) : null,
                reason,
                reasonEn: language === 'en' ? reason : null,
            },
        );
        const user = await findUserById(req.user.id);
        res.json({ user: toProfile(user) });
    }));

    app.get('/api/days', requireAuth, asyncHandler(async (_req, res) => {
        const teacherId = await defaultTeacherId();
        const result = await query(
            `SELECT DISTINCT CONVERT(varchar(10), slot_date, 23) AS iso
             FROM dbo.teacher_availability
             WHERE teacher_id = @teacherId
               AND slot_date >= CONVERT(date, GETDATE())
               AND slot_date < DATEADD(day, 45, GETDATE())
               AND status = N'open'
             ORDER BY iso`,
            { teacherId },
        );
        res.json(result.recordset.map((row) => row.iso));
    }));

    app.get('/api/slots', requireAuth, asyncHandler(async (req, res) => {
        const day = assertDayIso(req.query.day);
        const teacherId = await defaultTeacherId();
        const result = await query(
            `SELECT CONVERT(varchar(5), slot_time, 108) AS time, status
             FROM dbo.teacher_availability
             WHERE teacher_id = @teacherId AND slot_date = @day
             ORDER BY slot_time`,
            { teacherId, day: toIsoDate(day) },
        );
        res.json(result.recordset.map((row) => ({
            time: row.time,
            status: slotStatus(row.status, resolveLang(req)),
            full: row.status !== 'open',
        })));
    }));

    app.get('/api/me/package-status', requireAuth, asyncHandler(async (req, res) => {
        res.json(packageStatusFromRow(await activePackage(req.user.id), resolveLang(req)));
    }));

    app.get('/api/booking-summary', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const day = assertDayIso(req.query.day);
        const time = String(req.query.time ?? '');
        const pkg = packageStatusFromRow(await activePackage(req.user.id), lang);
        res.json({
            day: `${chipLabel(day, lang)} ${formatDate(day, lang)}`,
            time: lessonTimeRange(time, lang),
            teacher: lang === 'en' ? 'Kru Air (live 1:1)' : 'ครูแอร์ (เรียนสด 1:1)',
            leftHours: pkg.left,
        });
    }));

    app.post('/api/bookings', requireAuth, asyncHandler(async (req, res) => {
        if (req.user.role !== 'student') {
            throw new Error('เฉพาะนักเรียนที่จองคิวได้');
        }
        const dayIso = String(req.body?.day ?? '');
        const time = String(req.body?.time ?? '');
        assertDayIso(dayIso);
        const lang = resolveLang(req);
        const booking = await createLessonBooking({
            publicId: publicId('L'),
            userId: req.user.id,
            dayIso,
            time,
            topic: lang === 'en' ? 'Course based on your favorite genres' : 'คอร์สตามแนวเพลงที่ชอบ',
            topicEn: 'Course based on your favorite genres',
            source: 'web',
            mode: req.body?.mode === 'online' ? 'online' : 'studio',
        });
        const student = await findUserById(req.user.id);
        const date = parseIsoDate(dayIso);
        await notifySlotTeacher(
            booking.slot_id,
            'มีนัดเรียนใหม่',
            `${studentLabel(student, 'th')} จอง ${chipLabel(date, 'th')} ${lessonTimeRange(time, 'th')} — รอคอนเฟิร์ม`,
            'blue',
            'New lesson booking',
            `${studentLabel(student, 'en')} booked ${chipLabel(date, 'en')} ${lessonTimeRange(time, 'en')} — awaiting confirmation`,
        );
        res.json({ id: booking.public_id, saved: true, status: booking.status });
    }));

    app.get('/api/me/lessons', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT b.public_id, b.status, b.topic, b.topic_en,
                    CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.user_id = @userId AND b.status IN ('pending', 'confirmed', 'moved')
             ORDER BY s.slot_date, s.slot_time`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map((row) => {
            const date = parseIsoDate(row.slot_iso);
            const hoursUntil = hoursUntilSlot(row.slot_iso, row.slot_hhmm);
            return {
                id: row.public_id,
                date: chipLabel(date, lang),
                time: lessonTimeRange(row.slot_hhmm, lang),
                teacher: lang === 'en' ? 'Kru Air (live 1:1)' : 'ครูแอร์ (เรียนสด 1:1)',
                status: row.status,
                topic: pick(row, 'topic', lang),
                canCancel: canStudentCancel({ status: row.status, hoursUntil }),
            };
        }));
    }));

    app.post('/api/me/lessons/:id/confirm', requireAuth, asyncHandler(async (req, res) => {
        const lesson = await loadLessonForUser(req.params.id, req.user.id);
        if (lesson.status !== 'pending') {
            throw new Error('นัดนี้ยืนยันแล้วหรือยกเลิกไปแล้ว');
        }
        await query(`UPDATE dbo.bookings SET status = 'confirmed', confirmed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @id AND status = N'pending'`, { id: lesson.id });
        const date = parseIsoDate(lesson.slot_iso);
        await addNotification(
            req.user.id,
            'ยืนยันนัดเรียนแล้ว',
            `ยืนยันการมาเรียน ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')} เรียบร้อย — แล้วพบกันนะครับ`,
            'green',
            'Attendance confirmed',
            `Confirmed for ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')} — see you soon.`,
        );
        const student = await findUserById(req.user.id);
        await notifySlotTeacher(
            lesson.slot_id,
            'นักเรียนยืนยันนัดแล้ว',
            `${studentLabel(student, 'th')} ยืนยัน ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')}`,
            'green',
            'Student confirmed attendance',
            `${studentLabel(student, 'en')} confirmed ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')}`,
        );
        res.json({ ok: true });
    }));

    app.post('/api/me/lessons/:id/cancel', requireAuth, asyncHandler(async (req, res) => {
        const lesson = await loadLessonForUser(req.params.id, req.user.id);
        const hoursUntil = hoursUntilSlot(lesson.slot_iso, lesson.slot_hhmm);
        if (!canStudentCancel({ status: lesson.status, hoursUntil })) {
            throw new Error('ยกเลิกได้น้อยกว่า 24 ชม.ก่อนเรียน กรุณาติดต่อครูแอร์');
        }
        const booking = await cancelLessonBooking({
            bookingRowId: lesson.id,
            reason: 'student_cancel',
            slotAfter: 'open',
        });
        const date = parseIsoDate(booking.slot_iso);
        await addNotification(
            req.user.id,
            'ยกเลิกนัดเรียนแล้ว',
            `ยกเลิกนัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} แล้ว — ชั่วโมงยังไม่ถูกหัก จองใหม่ได้เลย`,
            'blue',
            'Lesson cancelled',
            `Cancelled ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} — hours were not deducted.`,
        );
        const student = await findUserById(req.user.id);
        await notifySlotTeacher(
            booking.slot_id,
            'นักเรียนยกเลิกนัด',
            `${studentLabel(student, 'th')} ยกเลิก ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} — สล็อตว่างแล้ว`,
            'pink',
            'Student cancelled a lesson',
            `${studentLabel(student, 'en')} cancelled ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} — the slot is open again`,
        );
        res.json({ ok: true });
    }));

    app.post('/api/me/lessons/:id/move', requireAuth, asyncHandler(async (req, res) => {
        const newDay = String(req.body?.day ?? '');
        const newTime = String(req.body?.time ?? '');
        assertDayIso(newDay);
        const found = await query(
            `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.public_id = @id AND b.user_id = @userId`,
            { id: req.params.id, userId: req.user.id },
        );
        const lesson = found.recordset[0];
        if (!lesson) {
            throw new Error('ไม่พบคลาสที่เลือก');
        }
        const teacherId = await defaultTeacherId();
        const slot = await findSlot(newDay, newTime, teacherId);
        if (!slot || slot.status !== 'open') {
            throw new Error('สล็อตใหม่ไม่ว่าง');
        }
        const fromDate = parseIsoDate(lesson.slot_iso);
        const toDate = parseIsoDate(newDay);
        await query(
            `INSERT INTO dbo.move_requests (public_id, booking_id, user_id, requested_slot_id, from_text, to_text, from_text_en, to_text_en, status)
             VALUES (@publicId, @bookingId, @userId, @slotId, @fromText, @toText, @fromTextEn, @toTextEn, 'pending');
             UPDATE dbo.bookings SET status = 'moved', updated_at = SYSUTCDATETIME() WHERE id = @bookingId;`,
            {
                publicId: publicId('MR'),
                bookingId: lesson.id,
                userId: req.user.id,
                slotId: slot.id,
                fromText: slotLabel(fromDate, lesson.slot_hhmm, 'th'),
                toText: slotLabel(toDate, newTime, 'th'),
                fromTextEn: slotLabel(fromDate, lesson.slot_hhmm, 'en'),
                toTextEn: slotLabel(toDate, newTime, 'en'),
            },
        );
        await addNotification(
            req.user.id,
            'ส่งคำขอเลื่อนนัดแล้ว',
            `ขอเลื่อนนัดเป็น ${slotLabel(toDate, newTime, 'th')} — ครูแอร์จะยืนยันอีกครั้งภายใน 24 ชม.`,
            'blue',
            'Move request sent',
            `Requested a move to ${slotLabel(toDate, newTime, 'en')} — Kru Air will confirm within 24 hours.`,
        );
        const student = await findUserById(req.user.id);
        await notifySlotTeacher(
            lesson.slot_id,
            'มีคำขอเลื่อนนัด',
            `${studentLabel(student, 'th')} ขอเลื่อนจาก ${slotLabel(fromDate, lesson.slot_hhmm, 'th')} เป็น ${slotLabel(toDate, newTime, 'th')}`,
            'pink',
            'Move request received',
            `${studentLabel(student, 'en')} asked to move from ${slotLabel(fromDate, lesson.slot_hhmm, 'en')} to ${slotLabel(toDate, newTime, 'en')}`,
        );
        res.json({ ok: true });
    }));

    app.get('/api/me/history', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT cl.lesson_title, cl.lesson_title_en, cl.note, cl.note_en, cl.feedback_audio_url, cl.hours_deducted, cl.outcome, cl.created_at,
                    CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.class_logs cl
             JOIN dbo.bookings b ON b.id = cl.booking_id
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE cl.user_id = @userId
             ORDER BY cl.created_at DESC`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map((row) => {
            const date = parseIsoDate(row.slot_iso);
            const noShow = lang === 'en' ? 'No-show' : 'No-show (ไม่มาเรียน)';
            return {
                date: chipLabel(date, lang),
                time: `${row.slot_hhmm}–${plusOneHour(row.slot_hhmm)}`,
                lesson: row.outcome === 'no_show' ? noShow : pick(row, 'lesson_title', lang),
                note: pick(row, 'note', lang) || '—',
                audioUrl: row.feedback_audio_url || null,
                usedHours: row.hours_deducted,
            };
        }));
    }));

    app.get('/api/me/receipts', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const hoursUnit = lang === 'en' ? 'hrs' : 'ชม.';
        const result = await query(
            `SELECT t.ref_no, t.created_at, t.voucher_code, t.discount_amount, t.net_amount, t.method, t.method_en, t.status,
                    p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours,
                    pay.payment_ref, pay.gateway_status
             FROM dbo.transactions t
             JOIN dbo.packages p ON p.id = t.package_id
             LEFT JOIN dbo.payments pay ON pay.transaction_id = t.id
             WHERE t.user_id = @userId
             ORDER BY t.created_at DESC`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map((row) => ({
            id: row.ref_no,
            date: formatDate(new Date(row.created_at), lang),
            pkg: `${pick({ name: row.pkg_name, name_en: row.pkg_name_en }, 'name', lang)} ${row.hours} ${hoursUnit}`,
            voucher: row.voucher_code ? `${row.voucher_code} (-${Number(row.discount_amount).toLocaleString()})` : '—',
            amount: Number(row.net_amount),
            method: pick(row, 'method', lang),
            status: paymentStatus(row.gateway_status || row.status, lang),
            paymentRef: row.payment_ref || null,
        })));
    }));

    app.get('/api/notifications', requireAuth, asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT TOP 20 * FROM dbo.notifications WHERE user_id = @userId ORDER BY created_at DESC`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map((row) => mapNotification(row, resolveLang(req))));
    }));

    app.post('/api/notifications/read', requireAuth, asyncHandler(async (req, res) => {
        await query(`UPDATE dbo.notifications SET is_read = N'Y' WHERE user_id = @userId`, { userId: req.user.id });
        res.json({ ok: true });
    }));

    app.post('/api/vouchers/validate', requireAuth, asyncHandler(async (req, res) => {
        const code = String(req.body?.code ?? '').trim().toUpperCase();
        const price = Number(req.body?.price ?? 0);
        const result = await query(
            `SELECT * FROM dbo.vouchers WHERE code = @code AND is_active = N'Y' AND (valid_to IS NULL OR valid_to >= SYSUTCDATETIME())`,
            { code },
        );
        const voucher = result.recordset[0];
        if (!voucher) {
            throw new Error(`โค้ด "${code}" ไม่ถูกต้องหรือหมดอายุ`);
        }
        if (voucher.max_uses != null && voucher.used_count >= voucher.max_uses) {
            throw new Error(`โค้ด "${code}" ถูกใช้ครบแล้ว`);
        }
        res.json({ discount: Math.min(discountForVoucher(voucher, price), Math.max(0, price)) });
    }));

    app.post('/api/purchases', requireAuth, asyncHandler(async (req, res) => {
        if (req.user.role !== 'student') {
            throw new Error('เฉพาะนักเรียนที่ซื้อแพ็กเกจได้');
        }
        const purchased = await createPackagePurchase({
            userId: req.user.id,
            pkgId: String(req.body?.pkgId ?? ''),
            voucherCode: String(req.body?.voucherCode ?? ''),
            method: String(req.body?.method ?? 'บัตรเครดิต'),
            enrollmentPublicId: publicId('enr-'),
            paymentPublicId: publicId('pay-'),
        });
        res.json({ ok: true, refNo: purchased.refNo });
    }));

    app.get('/api/admin/students', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT u.name, u.name_en, u.nickname, u.nickname_en, u.age, u.education, u.education_en, u.phone, u.emergency_contact, u.created_at,
                    p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours AS pkg_hours,
                    up.hours_total, up.hours_used, up.expires_at, up.status AS pkg_status,
                    (SELECT COUNT(*) FROM dbo.class_logs cl WHERE cl.user_id = u.id AND cl.outcome = 'done') AS done
             FROM dbo.users u
             LEFT JOIN dbo.user_packages up ON up.id = (
                SELECT TOP 1 id FROM dbo.user_packages WHERE user_id = u.id ORDER BY created_at DESC
             )
             LEFT JOIN dbo.packages p ON p.id = up.package_id
             WHERE u.role = 'student'
             ORDER BY u.created_at DESC`,
        );
        res.json(result.recordset.map((row) => {
            const left = row.hours_total == null ? 0 : Math.max(0, row.hours_total - row.hours_used);
            const expired = row.expires_at && new Date(row.expires_at) < new Date();
            let state = 'active';
            if (!row.pkg_name || expired || left === 0) {
                state = row.done > 0 ? 'expired' : 'new';
            }
            if (row.pkg_name && left > 0 && !expired && row.done === 0) {
                state = 'new';
            }
            return {
                name: `${pick(row, 'nickname', lang)} ${pick(row, 'name', lang).split(' ')[0] ?? ''}`.trim(),
                info: `${row.age ?? '—'} · ${pick(row, 'education', lang) || '—'} · ${row.phone || '—'}`,
                phone: row.phone || null,
                emergencyContact: row.emergency_contact || null,
                pkg: row.pkg_name ? `${pick({ name: row.pkg_name, name_en: row.pkg_name_en }, 'name', lang)} ${row.pkg_hours}` : '—',
                left,
                done: row.done,
                state,
            };
        }));
    }));

    app.get('/api/admin/users', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT u.id, u.role, u.email, u.phone, u.name, u.name_en, u.nickname, u.nickname_en, u.age, u.education, u.education_en,
                    u.status, u.avatar, u.created_at,
                    p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours AS pkg_hours,
                    up.hours_total, up.hours_used
             FROM dbo.users u
             LEFT JOIN dbo.user_packages up ON up.id = (
                SELECT TOP 1 id FROM dbo.user_packages WHERE user_id = u.id ORDER BY created_at DESC
             )
             LEFT JOIN dbo.packages p ON p.id = up.package_id
             ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.created_at DESC`,
        );
        res.json(result.recordset.map((row) => {
            const left = row.hours_total == null ? null : Math.max(0, row.hours_total - row.hours_used);
            return {
                id: Number(row.id),
                role: row.role,
                email: row.email,
                phone: row.phone,
                name: pick(row, 'name', lang),
                nickname: pick(row, 'nickname', lang),
                nameTh: row.name,
                nameEn: row.name_en ?? '',
                nicknameTh: row.nickname,
                nicknameEn: row.nickname_en ?? '',
                age: row.age,
                education: pick(row, 'education', lang),
                status: isYes(row.status) || row.status === 'active' ? 'Y' : 'N',
                avatar: row.avatar,
                createdAt: formatDate(new Date(row.created_at), lang),
                pkg: row.pkg_name
                    ? `${pick({ name: row.pkg_name, name_en: row.pkg_name_en }, 'name', lang)} ${row.pkg_hours}`
                    : '—',
                left,
            };
        }));
    }));

    app.post('/api/admin/users', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const input = req.body ?? {};
        const role = String(input.role ?? 'teacher').toLowerCase() === 'student' ? 'student' : 'teacher';
        const names = requiredPersonNames(input);
        const email = String(input.email ?? '').trim().toLowerCase();
        const password = String(input.password ?? '');
        const rawPhone = String(input.phone ?? '').trim();
        const phone = rawPhone ? normalizePhone(rawPhone) : '';
        if (phone && !/^0\d{8,9}$/.test(phone)) {
            throw new Error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
        }
        if (!email) {
            throw new Error('กรุณากรอกอีเมล');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
        }
        if (password.length < 6) {
            throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        }
        const existing = await findUserByLogin(email);
        if (existing) {
            throw new Error('อีเมลนี้มีในระบบแล้ว');
        }
        if (phone) {
            const existingPhone = await findUserByLogin(phone);
            if (existingPhone) {
                throw new Error('เบอร์โทรนี้มีในระบบแล้ว');
            }
        }
        const hash = await bcrypt.hash(password, 10);
        const avatar = defaultAvatar(role, email);
        const inserted = await query(
            `INSERT INTO dbo.users (role, email, phone, password_hash, name, name_en, nickname, nickname_en, language, avatar, consent_pdpa_at)
             OUTPUT INSERTED.*
             VALUES (@role, @email, @phone, @hash, @name, @nameEn, @nickname, @nicknameEn, N'th', @avatar, SYSUTCDATETIME())`,
            {
                role,
                email,
                phone: phone || null,
                hash,
                name: names.name,
                nameEn: names.nameEn,
                nickname: names.nickname,
                nicknameEn: names.nicknameEn,
                avatar,
            },
        );
        const created = inserted.recordset[0];
        if (role === 'teacher') {
            await ensureTeacherAvailability(created.id);
        }
        res.json({ ok: true, user: toProfile(created) });
    }));

    app.patch('/api/admin/users/:id/status', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId < 1) {
            throw new Error('ไม่พบบัญชีนี้');
        }
        const found = await query(`SELECT * FROM dbo.users WHERE id = @id`, { id: userId });
        const target = found.recordset[0];
        if (!target) {
            throw new Error('ไม่พบบัญชีนี้');
        }
        if (target.id === req.user.id) {
            throw new Error('ไม่สามารถระงับบัญชีของตัวเองได้');
        }
        const raw = String(req.body?.status ?? '').toLowerCase();
        const status = raw === 'y' || raw === 'active' ? 'Y' : 'N';
        if (target.role === 'admin' && status !== 'Y') {
            const admins = await query(`SELECT COUNT(*) AS n FROM dbo.users WHERE role = 'admin' AND status = N'Y' AND id <> @id`, { id: target.id });
            if (Number(admins.recordset[0].n) < 1) {
                throw new Error('ต้องมีแอดมินที่ใช้งานได้อย่างน้อย 1 คน');
            }
        }
        await query(`UPDATE dbo.users SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @id`, {
            status,
            id: target.id,
        });
        res.json({ ok: true, status });
    }));

    app.get('/api/admin/sales', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const now = new Date();
        const hoursUnit = lang === 'en' ? 'hrs' : 'ชม.';
        const txs = await query(
            `SELECT t.*, COALESCE(t.paid_at, t.created_at) AS analytics_at,
                    u.nickname, u.nickname_en, p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours
             FROM dbo.transactions t
             LEFT JOIN dbo.users u ON u.id = t.user_id
             LEFT JOIN dbo.packages p ON p.id = CASE CAST(t.package_id AS NVARCHAR(20))
                 WHEN N'1' THEN N'beginner'
                 WHEN N'2' THEN N'pro'
                 WHEN N'3' THEN N'master'
                 ELSE CAST(t.package_id AS NVARCHAR(20))
             END
             WHERE LOWER(t.status) IN (N'success', N'paid', N'completed')
                OR t.paid_at IS NOT NULL
             ORDER BY COALESCE(t.paid_at, t.created_at) DESC`,
        );
        const rows = txs.recordset;
        const anchor = rows[0]?.analytics_at ? new Date(rows[0].analytics_at) : now;
        const anchorMonthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
        const packageLabel = (row) => {
            if (row.pkg_name) {
                return `${pick({ name: row.pkg_name, name_en: row.pkg_name_en }, 'name', lang)} ${row.hours} ${hoursUnit}`;
            }
            const fallbackHours = { 1: 10, 2: 20, 3: 30 }[String(row.package_id)];
            return fallbackHours ? `Package ${fallbackHours} ${hoursUnit}` : `Package ${row.package_id}`;
        };
        const rowsBetween = (start, end) => rows.filter((row) => {
            const at = new Date(row.analytics_at);
            return at >= start && at < end;
        });
        const packageBreakdown = (periodRows) => periodRows.reduce((acc, row) => {
            const label = packageLabel(row);
            acc[label] = (acc[label] ?? 0) + 1;
            return acc;
        }, {});
        const periodPoint = (period, axisLabel, periodRows, meta = {}) => ({
            period,
            axisLabel,
            revenue: periodRows.reduce((acc, row) => acc + Number(row.net_amount), 0),
            orders: periodRows.length,
            packages: packageBreakdown(periodRows),
            ...meta,
        });
        const groupRows = (keyFor) => {
            const groups = new Map();
            rows.forEach((row) => {
                const at = new Date(row.analytics_at);
                const key = keyFor(at);
                const next = groups.get(key) ?? [];
                next.push(row);
                groups.set(key, next);
            });
            return groups;
        };
        const dailyGroups = groupRows((date) => date.toISOString().slice(0, 10));
        const visibleDaily = Array.from(dailyGroups.entries()).map(([key, periodRows]) => {
            const date = new Date(`${key}T00:00:00`);
            return periodPoint(formatDate(date, lang), String(date.getDate()), periodRows, {
                key,
                year: date.getFullYear(),
                month: date.getMonth() + 1,
                day: date.getDate(),
            });
        }).sort((a, b) => a.key.localeCompare(b.key));
        const monthlyGroups = groupRows((date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        const visibleMonthly = Array.from(monthlyGroups.entries()).map(([key, periodRows]) => {
            const [year, month] = key.split('-').map(Number);
            const date = new Date(year, month - 1, 1);
            return periodPoint(monthYear(date, lang), monthYear(date, lang).split(' ')[0], periodRows, {
                key,
                year,
                month,
            });
        }).sort((a, b) => a.key.localeCompare(b.key));
        const yearlyGroups = groupRows((date) => String(date.getFullYear()));
        const visibleYearly = Array.from(yearlyGroups.entries()).map(([key, periodRows]) => periodPoint(key, key, periodRows, {
            key,
            year: Number(key),
        })).sort((a, b) => a.year - b.year);
        const monthRows = rows.filter((row) => new Date(row.analytics_at) >= anchorMonthStart);
        const monthly = visibleMonthly.map((item) => ({
            label: item.axisLabel,
            value: Math.round(item.revenue / 1000),
        }));
        const newStudents = await query(
            `SELECT COUNT(*) AS n FROM dbo.users WHERE role = 'student' AND created_at >= @monthStart`,
            { monthStart: anchorMonthStart.toISOString() },
        );
        res.json({
            revenue: monthRows.reduce((acc, row) => acc + Number(row.net_amount), 0),
            orders: monthRows.length,
            vouchersUsed: monthRows.filter((row) => row.voucher_code).length,
            newStudents: Number(newStudents.recordset[0].n),
            monthly,
            analytics: {
                daily: visibleDaily,
                monthly: visibleMonthly,
                yearly: visibleYearly,
            },
            sales: rows.map((row) => ({
                date: formatDate(new Date(row.analytics_at), lang),
                paidAt: new Date(row.analytics_at).toISOString(),
                student: pick(row, 'nickname', lang) || `User #${row.user_id}`,
                pkg: packageLabel(row),
                voucher: row.voucher_code || '—',
                amount: Number(row.net_amount),
                method: pick(row, 'method', lang),
            })),
        });
    }));

    app.get('/api/admin/vouchers', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(`SELECT * FROM dbo.vouchers ORDER BY id DESC`);
        res.json(result.recordset.map((row) => mapAdminVoucher(row, lang)));
    }));

    app.post('/api/admin/vouchers', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const code = String(req.body?.code ?? '').trim().toUpperCase();
        const type = req.body?.type === 'percent' ? 'percent' : 'fixed';
        const value = Number(req.body?.value);
        const maxDiscount = req.body?.maxDiscount == null || req.body?.maxDiscount === ''
            ? null
            : Number(req.body.maxDiscount);
        const validTo = String(req.body?.validTo ?? '').trim() || null;
        const maxUses = req.body?.maxUses == null || req.body?.maxUses === ''
            ? null
            : Number(req.body.maxUses);
        const isActive = toYn(req.body?.isActive !== false);
        if (!code) {
            throw new Error('กรุณาระบุโค้ดวอเชอร์');
        }
        if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
            throw new Error('โค้ดใช้ได้เฉพาะ A-Z, 0-9, - และ _ ความยาว 3-30 ตัว');
        }
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error('กรุณาระบุมูลค่าส่วนลด');
        }
        if (type === 'percent' && value > 100) {
            throw new Error('เปอร์เซ็นต์ส่วนลดต้องไม่เกิน 100');
        }
        if (maxUses != null && (!Number.isFinite(maxUses) || maxUses < 1)) {
            throw new Error('จำนวนครั้งที่ใช้ได้ไม่ถูกต้อง');
        }
        try {
            await query(
                `INSERT INTO dbo.vouchers (code, type, value, max_discount, valid_to, max_uses, used_count, is_active)
                 VALUES (@code, @type, @value, @maxDiscount, @validTo, @maxUses, 0, @isActive)`,
                {
                    code,
                    type,
                    value,
                    maxDiscount: type === 'percent' && Number.isFinite(maxDiscount) ? maxDiscount : null,
                    validTo,
                    maxUses,
                    isActive,
                },
            );
        }
        catch (err) {
            const number = err?.number ?? err?.originalError?.info?.number;
            if (number === 2627 || number === 2601) {
                throw new Error('โค้ดวอเชอร์นี้มีอยู่แล้ว');
            }
            throw err;
        }
        res.json({ ok: true });
    }));

    app.patch('/api/admin/vouchers/:code/status', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const code = String(req.params.code ?? '').trim().toUpperCase();
        const isActive = toYn(!(req.body?.active === false || req.body?.status === 'disabled'));
        const result = await query(
            `UPDATE dbo.vouchers SET is_active = @isActive WHERE code = @code`,
            { code, isActive },
        );
        if (!result.rowsAffected?.[0]) {
            throw new Error('ไม่พบวอเชอร์นี้');
        }
        res.json({ ok: true });
    }));

    app.get('/api/admin/move-requests', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT m.*, u.nickname, u.nickname_en, b.public_id AS booking_public_id,
                    CONVERT(varchar(10), s.slot_date, 23) AS requested_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS requested_time
             FROM dbo.move_requests m
             JOIN dbo.users u ON u.id = m.user_id
             JOIN dbo.bookings b ON b.id = m.booking_id
             JOIN dbo.teacher_availability s ON s.id = m.requested_slot_id
             ORDER BY m.created_at DESC`,
        );
        res.json(result.recordset.map((row) => mapMoveRequest(row, resolveLang(req))));
    }));

    app.post('/api/admin/move-requests/:id/decide', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const approve = Boolean(req.body?.approve);
        const found = await query(
            `SELECT m.*, b.slot_id AS old_slot_id, b.user_id AS student_id, b.id AS booking_row_id
             FROM dbo.move_requests m
             JOIN dbo.bookings b ON b.id = m.booking_id
             WHERE m.public_id = @id`,
            { id: req.params.id },
        );
        const row = found.recordset[0];
        if (!row) {
            throw new Error('ไม่พบคำขอ');
        }
        if (approve) {
            const slot = await query(`SELECT status FROM dbo.teacher_availability WHERE id = @id`, { id: row.requested_slot_id });
            if (slot.recordset[0]?.status !== 'open') {
                throw new Error('สล็อตใหม่ไม่ว่างแล้ว');
            }
            await query(
                `UPDATE dbo.teacher_availability SET status = 'open' WHERE id = @oldSlot;
                 UPDATE dbo.teacher_availability SET status = 'booked' WHERE id = @newSlot;
                 UPDATE dbo.bookings SET slot_id = @newSlot, status = 'confirmed', confirmed_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME() WHERE id = @bookingId;
                 UPDATE dbo.move_requests SET status = 'approved', decided_by = @decidedBy, decided_at = SYSUTCDATETIME() WHERE id = @id;`,
                { oldSlot: row.old_slot_id, newSlot: row.requested_slot_id, bookingId: row.booking_row_id, decidedBy: req.user.id, id: row.id },
            );
            await addNotification(
                row.student_id,
                'อนุมัติเลื่อนนัดแล้ว',
                `เลื่อนนัดเป็น ${row.to_text} เรียบร้อย — อัปเดตตารางเรียนแล้ว`,
                'green',
                'Move approved',
                `Your lesson was moved to ${row.to_text_en || row.to_text}. The schedule is updated.`,
            );
        }
        else {
            await query(
                `UPDATE dbo.bookings SET status = 'pending', updated_at = SYSUTCDATETIME() WHERE id = @bookingId;
                 UPDATE dbo.move_requests SET status = 'rejected', decided_by = @decidedBy, decided_at = SYSUTCDATETIME() WHERE id = @id;`,
                { bookingId: row.booking_row_id, decidedBy: req.user.id, id: row.id },
            );
            await addNotification(
                row.student_id,
                'ปฏิเสธคำขอเลื่อนนัด',
                'ครูแอร์ยังสะดวกเวลานัดเดิม — ติดต่อครูแอร์เพื่อปรึกษาเวลาใหม่ได้เลย',
                'pink',
                'Move request declined',
                'Kru Air is keeping the original time. Please contact the teacher to discuss a new slot.',
            );
        }
        res.json({ ok: true });
    }));

    app.get('/api/admin/settings', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const origin = String(process.env.FRONTEND_ORIGIN || '').replace(/\/$/, '');
        const callbackUrl = String(process.env.LINE_CALLBACK_URL || '').trim();
        const sqlHost = String(process.env.SQL_SERVER || '').split(',')[0].trim();
        const pkgs = await query(
            `SELECT id, name, name_en, hours, price, note, note_en, tag, tag_en, tone, is_active
             FROM dbo.packages ORDER BY hours`,
        );
        const roles = await query(
            `SELECT role, COUNT(*) AS n FROM dbo.users WHERE status = N'Y' GROUP BY role`,
        );
        const upcoming = await query(
            `SELECT COUNT(*) AS n FROM dbo.bookings WHERE status IN (N'pending', N'confirmed')`,
        );
        const counts = { student: 0, teacher: 0, admin: 0 };
        for (const row of roles.recordset) {
            if (row.role in counts) {
                counts[row.role] = Number(row.n);
            }
        }
        res.json({
            school: {
                name: lang === 'en' ? 'Kru Air Singing School' : 'ครูแอร์ Singing School',
                publicUrl: origin || 'https://kruair.thanvasupos.com',
                studio: lang === 'en' ? 'Live 1:1 vocal lesson' : 'เรียนร้องเพลงสด ตัวต่อตัว 1:1',
                closedDay: lang === 'en' ? 'Closed on Monday' : 'หยุดวันจันทร์',
            },
            accounts: {
                ...counts,
                upcomingLessons: Number(upcoming.recordset[0]?.n || 0),
            },
            packages: pkgs.recordset.map((row) => ({
                ...localizePackage(row, lang),
                active: isYes(row.is_active),
            })),
            schedule: {
                slotMinutes: 60,
                slotTimes: SLOT_TIMES,
                workingHours: lang === 'en' ? 'Tue–Sun 10:00–19:00' : 'อังคาร–อาทิตย์ 10:00–19:00 น.',
                confirmHours: 24,
                cancelHours: CANCEL_MIN_HOURS,
                reminderWindowHours: [20, 28],
                packageMonths: 6,
                trialHours: 1,
            },
            integrations: {
                lineLogin: {
                    configured: isLineConfigured(),
                    callbackUrl: callbackUrl || null,
                },
                lineOa: { connected: false },
                payment: {
                    mode: 'mock',
                    methods: ['card', 'kbank', 'promptpay'],
                },
            },
            jobs: {
                enabled: jobState.enabled,
                lastRunAt: jobState.lastRunAt,
                lastExpired: jobState.lastResult.expired,
                lastReminded: jobState.lastResult.reminded,
                dayBefore: { enabled: true, channel: 'in_app' },
                expireUnconfirmed: { enabled: true },
                packageExpiry: { enabled: false },
            },
            data: {
                database: process.env.SQL_DATABASE || 'BD_AIR',
                sqlHost: sqlHost || null,
                https: origin.startsWith('https://'),
                rbac: true,
                pdpaConsentStored: true,
                dsrSelfService: false,
                dailyBackup: false,
            },
        });
    }));

    app.get('/api/teacher/schedule', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const now = new Date();
        const year = Number(req.query.year) || now.getFullYear();
        const month = Number(req.query.month) || (now.getMonth() + 1);
        if (month < 1 || month > 12 || year < 2020 || year > 2100) {
            throw new Error('เดือนไม่ถูกต้อง');
        }
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 0);
        const teacherId = await teacherScopeId(req);
        const result = await listTeacherMonthSlots({
            teacherId,
            start: toIsoDate(start),
            end: toIsoDate(end),
        });
        const lessonsByDate = {};
        const slotsByDate = {};
        let pendingCount = 0;
        for (const row of result.recordset) {
            if (!slotsByDate[row.slot_iso]) {
                slotsByDate[row.slot_iso] = [];
            }
            slotsByDate[row.slot_iso].push({
                id: row.id,
                time: row.slot_hhmm,
                status: row.status,
                bookingId: row.booking_id || null,
            });
            if (!row.booking_id) {
                continue;
            }
            const status = row.booking_status === 'confirmed' ? 'confirmed' : 'pending';
            if (status === 'pending') {
                pendingCount += 1;
            }
            const lesson = {
                bookingId: row.booking_id,
                slotId: row.id,
                time: row.slot_hhmm,
                student: studentLabel(row, lang),
                studentName: pick(row, 'name', lang),
                lesson: pick(row, 'topic', lang) || (lang === 'en' ? 'Course based on your favorite genres' : 'คอร์สตามแนวเพลงที่ชอบ'),
                status,
            };
            if (!lessonsByDate[row.slot_iso]) {
                lessonsByDate[row.slot_iso] = [];
            }
            lessonsByDate[row.slot_iso].push(lesson);
        }
        res.json({
            title: lang === 'en' ? `Schedule · ${monthYear(start, lang)}` : `ตารางสอน · ${monthYear(start, lang)}`,
            year,
            month,
            pendingCount,
            lessonsByDate,
            slotsByDate,
            slotTimes: SLOT_TIMES,
        });
    }));

    app.post('/api/teacher/slots', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const teacherId = await teacherScopeId(req);
        const day = String(req.body?.day ?? '');
        const time = String(req.body?.time ?? '');
        await createTeacherSlot({ teacherId, dayIso: day, time });
        res.json({ ok: true });
    }));

    app.patch('/api/teacher/slots/:id', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const teacherId = await teacherScopeId(req);
        const slotId = Number(req.params.id);
        const action = String(req.body?.action ?? '').toLowerCase() === 'open' ? 'open' : 'close';
        if (!Number.isInteger(slotId) || slotId < 1) {
            throw new Error('ไม่พบสล็อตนี้');
        }
        const result = await setTeacherSlotStatus({ slotId, action, teacherId });
        if (result.cancelled && result.booking) {
            const date = parseIsoDate(result.booking.slot_iso);
            await addNotification(
                result.booking.user_id,
                'ครูปิดสล็อตนี้แล้ว',
                `นัด ${chipLabel(date, 'th')} ${lessonTimeRange(result.booking.slot_hhmm, 'th')} ถูกยกเลิกเพราะครูปิดตาราง — จองเวลาใหม่ได้เลย ชั่วโมงยังไม่ถูกหัก`,
                'pink',
                'Teacher closed this slot',
                `Your lesson on ${chipLabel(date, 'en')} ${lessonTimeRange(result.booking.slot_hhmm, 'en')} was cancelled because the teacher closed the slot. Hours were not deducted.`,
            );
        }
        res.json({ ok: true, ...result, booking: undefined });
    }));

    app.post('/api/teacher/slots/bulk-close', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const teacherId = await teacherScopeId(req);
        const result = await bulkCloseTeacherSlots({
            teacherId,
            fromIso: String(req.body?.from ?? ''),
            toIso: String(req.body?.to ?? ''),
        });
        res.json({ ok: true, ...result });
    }));

    app.post('/api/teacher/bookings/:id/remind', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const found = await query(
            `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.public_id = @id AND b.status IN (N'pending', N'confirmed')`,
            { id: req.params.id },
        );
        const booking = found.recordset[0];
        if (!booking) {
            throw new Error('ไม่พบคลาสที่เลือก');
        }
        const date = parseIsoDate(booking.slot_iso);
        await addNotification(
            booking.user_id,
            'ครูทวงถามการมาเรียน',
            `กรุณายืนยันนัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} ในหน้าแรกของเว็บ`,
            'blue',
            'Please confirm your lesson',
            `Please confirm ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} from the home page.`,
        );
        await query(
            `UPDATE dbo.bookings SET reminder_sent_at = SYSUTCDATETIME() WHERE id = @id`,
            { id: booking.id },
        );
        res.json({ ok: true });
    }));

    app.post('/api/teacher/bookings/:id/cancel', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const found = await query(
            `SELECT b.*, CONVERT(varchar(10), s.slot_date, 23) AS slot_iso, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.public_id = @id`,
            { id: req.params.id },
        );
        const lesson = found.recordset[0];
        if (!lesson) {
            throw new Error('ไม่พบคลาสที่เลือก');
        }
        const booking = await cancelLessonBooking({
            bookingRowId: lesson.id,
            reason: String(req.body?.reason ?? 'teacher_cancel').slice(0, 200),
            slotAfter: 'open',
        });
        const date = parseIsoDate(booking.slot_iso);
        await addNotification(
            booking.user_id,
            'ครูยกเลิกนัดเรียน',
            `นัด ${chipLabel(date, 'th')} ${lessonTimeRange(booking.slot_hhmm, 'th')} ถูกยกเลิก — ชั่วโมงยังไม่ถูกหัก จองใหม่ได้เลย`,
            'pink',
            'Teacher cancelled the lesson',
            `Your lesson on ${chipLabel(date, 'en')} ${lessonTimeRange(booking.slot_hhmm, 'en')} was cancelled. Hours were not deducted.`,
        );
        res.json({ ok: true });
    }));

    app.post('/api/teacher/bookings/:id/log', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const outcome = req.body?.outcome === 'no_show' ? 'no_show' : 'done';
        const note = String(req.body?.note ?? '').trim() || (outcome === 'done' ? 'บันทึกโดยครูแอร์' : '—');
        const found = await query(
            `SELECT b.*, s.id AS slot_row_id, CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm
             FROM dbo.bookings b
             JOIN dbo.teacher_availability s ON s.id = b.slot_id
             WHERE b.public_id = @id`,
            { id: req.params.id },
        );
        const booking = found.recordset[0];
        if (!booking) {
            throw new Error('ไม่พบคลาสที่เลือก');
        }
        const audioUrl = String(req.body?.feedbackAudioUrl ?? '').trim().slice(0, 500) || null;
        const already = await query(`SELECT id FROM dbo.class_logs WHERE booking_id = @id`, { id: booking.id });
        if (already.recordset[0]) {
            throw new Error('บันทึกการสอนคลาสนี้แล้ว');
        }
        const pkg = booking.user_package_id
            ? { id: booking.user_package_id }
            : await activePackage(booking.user_id);
        await query(
            `INSERT INTO dbo.class_logs (booking_id, user_id, lesson_title, lesson_title_en, note, note_en, feedback_audio_url, hours_deducted, outcome)
             VALUES (@bookingId, @userId, @title, @titleEn, @note, @noteEn, @audioUrl, 1, @outcome);
             UPDATE dbo.bookings SET status = @status, updated_at = SYSUTCDATETIME() WHERE id = @bookingId;`,
            {
                bookingId: booking.id,
                userId: booking.user_id,
                title: booking.topic || 'เทคนิคการหายใจ + สเกลพื้นฐาน',
                titleEn: booking.topic_en || 'Breathing technique + basic scales',
                note,
                noteEn: null,
                audioUrl,
                outcome,
                status: outcome === 'done' ? 'done' : 'no_show',
            },
        );
        if (pkg?.id) {
            await query(`UPDATE dbo.user_packages SET hours_used = hours_used + 1 WHERE id = @pkgId`, { pkgId: pkg.id });
        }
        const student = await findUserById(booking.user_id);
        await addNotification(
            booking.user_id,
            outcome === 'done' ? 'บันทึกการเรียนแล้ว' : 'บันทึกว่าไม่มาเรียน',
            outcome === 'done'
                ? `ครูแอร์บันทึกคลาสแล้ว หัก 1 ชม. จากบัญชีของน้อง${student?.nickname ?? ''}`
                : 'บันทึก No-show และหัก 1 ชม. ตามเงื่อนไขแพ็กเกจ',
            outcome === 'done' ? 'green' : 'pink',
            outcome === 'done' ? 'Lesson recorded' : 'Marked as no-show',
            outcome === 'done'
                ? `Kru Air recorded the class and deducted 1 hour from ${student?.nickname ?? 'your'} account.`
                : 'Marked as no-show and deducted 1 hour per package terms.',
        );
        res.json({ ok: true });
    }));
}

export { publicId };
