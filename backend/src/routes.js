import bcrypt from 'bcryptjs';
import { asyncHandler, requireAuth, requireRole, signUser, toProfile } from './auth.js';
import { chipLabel, formatDate, lessonTimeRange, localizePackage, monthYear, paymentStatus, pick, resolveLang, slotLabel, slotStatus } from './lang.js';
import { defaultAvatar } from './avatar.js';
import { parseIsoDate, plusOneHour, toIsoDate } from './dates.js';
import {
    activePackage,
    addNotification,
    assertDayIso,
    defaultTeacherId,
    createLessonBooking,
    discountForVoucher,
    enrollStudent,
    ensureTeacherAvailability,
    findSlot,
    findUserById,
    findUserByLogin,
    mapMoveRequest,
    mapNotification,
    packageStatusFromRow,
    query,
} from './store.js';

function publicId(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
        state: row.is_active ? 'active' : 'draft',
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
        if (user.status && user.status !== 'active') {
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
        if (!input.name || !input.nickname || !input.age || !input.education || !input.genres?.length || !input.reason) {
            throw new Error('กรุณากรอกข้อมูลให้ครบทุกช่อง');
        }
        if (!input.consent) {
            throw new Error('กรุณายอมรับนโยบาย PDPA');
        }
        const email = String(input.email ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('กรุณากรอกอีเมลให้ถูกต้อง');
        }
        if (String(input.password ?? '').length < 6) {
            throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
        }
        const existing = await findUserByLogin(email);
        if (existing) {
            throw new Error('อีเมลนี้ลงทะเบียนแล้ว — เข้าสู่ระบบเลย');
        }
        const hash = await bcrypt.hash(String(input.password), 10);
        const language = resolveLang(req);
        const avatar = defaultAvatar('student', email);
        const enrolled = await enrollStudent({
            publicId: publicId('stu-'),
            enrollmentId: publicId('enr-'),
            email,
            hash,
            name: String(input.name),
            nickname: String(input.nickname),
            age: Number(input.age),
            education: String(input.education),
            genres: JSON.stringify(input.genres),
            reason: String(input.reason),
            language,
            avatar,
        });
        res.json({
            token: signUser(enrolled.user),
            user: toProfile(enrolled.user),
            saved: {
                enrollmentId: enrolled.enrollmentId,
                hoursGranted: enrolled.hoursGranted,
            },
        });
    }));

    app.get('/api/packages', asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(`SELECT id, name, name_en, hours, price, note, note_en, tag, tag_en, tone FROM dbo.packages WHERE is_active = 1 ORDER BY hours`);
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
        });
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
            return {
                id: row.public_id,
                date: chipLabel(date, lang),
                time: lessonTimeRange(row.slot_hhmm, lang),
                teacher: lang === 'en' ? 'Kru Air (live 1:1)' : 'ครูแอร์ (เรียนสด 1:1)',
                status: row.status,
                topic: pick(row, 'topic', lang),
            };
        }));
    }));

    app.post('/api/me/lessons/:id/confirm', requireAuth, asyncHandler(async (req, res) => {
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
        await query(`UPDATE dbo.bookings SET status = 'confirmed', confirmed_at = SYSUTCDATETIME() WHERE id = @id`, { id: lesson.id });
        const date = parseIsoDate(lesson.slot_iso);
        await addNotification(
            req.user.id,
            'ยืนยันนัดเรียนแล้ว',
            `ยืนยันการมาเรียน ${chipLabel(date, 'th')} ${lessonTimeRange(lesson.slot_hhmm, 'th')} เรียบร้อย — แล้วพบกันนะครับ`,
            'green',
            'Attendance confirmed',
            `Confirmed for ${chipLabel(date, 'en')} ${lessonTimeRange(lesson.slot_hhmm, 'en')} — see you soon.`,
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
             UPDATE dbo.bookings SET status = 'moved' WHERE id = @bookingId;`,
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
        res.json({ ok: true });
    }));

    app.get('/api/me/history', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT cl.lesson_title, cl.lesson_title_en, cl.note, cl.note_en, cl.hours_deducted, cl.outcome, cl.created_at,
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
                usedHours: row.hours_deducted,
            };
        }));
    }));

    app.get('/api/me/receipts', requireAuth, asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const hoursUnit = lang === 'en' ? 'hrs' : 'ชม.';
        const result = await query(
            `SELECT t.ref_no, t.created_at, t.voucher_code, t.discount_amount, t.net_amount, t.method, t.status,
                    p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours
             FROM dbo.transactions t
             JOIN dbo.packages p ON p.id = t.package_id
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
            method: row.method,
            status: paymentStatus(row.status, lang),
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
        await query(`UPDATE dbo.notifications SET is_read = 1 WHERE user_id = @userId`, { userId: req.user.id });
        res.json({ ok: true });
    }));

    app.post('/api/vouchers/validate', requireAuth, asyncHandler(async (req, res) => {
        const code = String(req.body?.code ?? '').trim().toUpperCase();
        const price = Number(req.body?.price ?? 0);
        const result = await query(
            `SELECT * FROM dbo.vouchers WHERE code = @code AND is_active = 1 AND (valid_to IS NULL OR valid_to >= SYSUTCDATETIME())`,
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
        const pkgId = String(req.body?.pkgId ?? '');
        const voucherCode = String(req.body?.voucherCode ?? '').trim().toUpperCase();
        const method = String(req.body?.method ?? 'บัตรเครดิต');
        const pkgResult = await query(`SELECT * FROM dbo.packages WHERE id = @id AND is_active = 1`, { id: pkgId });
        const pkg = pkgResult.recordset[0];
        if (!pkg) {
            throw new Error('ไม่พบแพ็กเกจที่เลือก');
        }
        let discount = 0;
        let voucher = null;
        if (voucherCode) {
            const voucherResult = await query(
                `SELECT * FROM dbo.vouchers WHERE code = @code AND is_active = 1 AND (valid_to IS NULL OR valid_to >= SYSUTCDATETIME())`,
                { code: voucherCode },
            );
            voucher = voucherResult.recordset[0];
            if (!voucher) {
                throw new Error(`โค้ด "${voucherCode}" ไม่ถูกต้องหรือหมดอายุ`);
            }
            if (voucher.max_uses != null && voucher.used_count >= voucher.max_uses) {
                throw new Error(`โค้ด "${voucherCode}" ถูกใช้ครบแล้ว`);
            }
            discount = Math.min(discountForVoucher(voucher, pkg.price), Number(pkg.price));
        }
        const net = Number(pkg.price) - discount;
        const count = await query(`SELECT COUNT(*) AS n FROM dbo.transactions`);
        const refNo = `INV-${new Date().getFullYear()}-${8800 + Number(count.recordset[0].n) + 1}`;
        const tx = await query(
            `INSERT INTO dbo.transactions (ref_no, user_id, package_id, gross_amount, discount_amount, net_amount, voucher_code, method, status, paid_at)
             OUTPUT INSERTED.*
             VALUES (@refNo, @userId, @pkgId, @gross, @discount, @net, @voucher, @method, 'success', SYSUTCDATETIME())`,
            {
                refNo,
                userId: req.user.id,
                pkgId,
                gross: Number(pkg.price),
                discount,
                net,
                voucher: voucherCode || null,
                method: method.split(' (')[0],
            },
        );
        const transaction = tx.recordset[0];
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 6);
        await query(
            `UPDATE dbo.user_packages SET status = 'expired' WHERE user_id = @userId AND status = 'active'`,
            { userId: req.user.id },
        );
        await query(
            `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status, transaction_id)
             VALUES (@userId, @pkgId, @hours, 0, @expires, 'active', @txId)`,
            { userId: req.user.id, pkgId, hours: pkg.hours, expires: expires.toISOString(), txId: transaction.id },
        );
        if (voucher) {
            await query(
                `UPDATE dbo.vouchers SET used_count = used_count + 1 WHERE id = @id;
                 INSERT INTO dbo.voucher_usages (voucher_id, transaction_id) VALUES (@id, @txId);`,
                { id: voucher.id, txId: transaction.id },
            );
        }
        const pkgName = pick(pkg, 'name', 'th');
        const pkgNameEn = pick(pkg, 'name', 'en');
        await addNotification(
            req.user.id,
            'ชำระเงินสำเร็จ',
            `ซื้อแพ็กเกจ ${pkgName} — เพิ่มชั่วโมงเข้าบัญชีแล้ว`,
            'green',
            'Payment successful',
            `${pkgNameEn} purchased — hours were added to your account.`,
        );
        res.json({ ok: true, refNo });
    }));

    app.get('/api/admin/students', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (req, res) => {
        const lang = resolveLang(req);
        const result = await query(
            `SELECT u.name, u.nickname, u.age, u.education, u.created_at,
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
                name: `${row.nickname} ${row.name.split(' ')[0] ?? ''}`.trim(),
                info: `${row.age ?? '—'} · ${row.education ?? '—'}`,
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
            `SELECT u.public_id, u.role, u.email, u.phone, u.name, u.nickname, u.age, u.education,
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
                id: row.public_id,
                role: row.role,
                email: row.email,
                phone: row.phone,
                name: row.name,
                nickname: row.nickname,
                age: row.age,
                education: row.education,
                status: row.status === 'active' ? 'active' : 'disabled',
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
        const name = String(input.name ?? '').trim();
        const nickname = String(input.nickname ?? '').trim();
        const email = String(input.email ?? '').trim().toLowerCase();
        const password = String(input.password ?? '');
        const phone = String(input.phone ?? '').trim();
        if (!name || !nickname || !email) {
            throw new Error('กรุณากรอกชื่อ ชื่อเล่น และอีเมล');
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
        const hash = await bcrypt.hash(password, 10);
        const avatar = defaultAvatar(role, email);
        const prefix = role === 'teacher' ? 'tch-' : 'stu-';
        const inserted = await query(
            `INSERT INTO dbo.users (public_id, role, email, phone, password_hash, name, nickname, language, avatar, consent_pdpa_at)
             OUTPUT INSERTED.*
             VALUES (@publicId, @role, @email, @phone, @hash, @name, @nickname, N'th', @avatar, SYSUTCDATETIME())`,
            {
                publicId: publicId(prefix),
                role,
                email,
                phone: phone || null,
                hash,
                name,
                nickname,
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
        const found = await query(`SELECT * FROM dbo.users WHERE public_id = @id`, { id: req.params.id });
        const target = found.recordset[0];
        if (!target) {
            throw new Error('ไม่พบบัญชีนี้');
        }
        if (target.id === req.user.id) {
            throw new Error('ไม่สามารถระงับบัญชีของตัวเองได้');
        }
        const status = String(req.body?.status ?? '').toLowerCase() === 'active' ? 'active' : 'disabled';
        if (target.role === 'admin' && status !== 'active') {
            const admins = await query(`SELECT COUNT(*) AS n FROM dbo.users WHERE role = 'admin' AND status = 'active' AND id <> @id`, { id: target.id });
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
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const txs = await query(
            `SELECT t.*, u.nickname, p.name AS pkg_name, p.name_en AS pkg_name_en, p.hours
             FROM dbo.transactions t
             JOIN dbo.users u ON u.id = t.user_id
             JOIN dbo.packages p ON p.id = t.package_id
             ORDER BY t.created_at DESC`,
        );
        const monthRows = txs.recordset.filter((row) => new Date(row.created_at) >= monthStart);
        const monthly = [];
        for (let i = 11; i >= 0; i -= 1) {
            const cursor = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const sum = txs.recordset
                .filter((row) => {
                    const at = new Date(row.created_at);
                    return at >= cursor && at < next;
                })
                .reduce((acc, row) => acc + Number(row.net_amount), 0);
            monthly.push({
                label: monthYear(cursor, lang).split(' ')[0],
                value: Math.round(sum / 1000),
            });
        }
        const newStudents = await query(
            `SELECT COUNT(*) AS n FROM dbo.users WHERE role = 'student' AND created_at >= @monthStart`,
            { monthStart: monthStart.toISOString() },
        );
        res.json({
            revenue: monthRows.reduce((acc, row) => acc + Number(row.net_amount), 0),
            orders: monthRows.length,
            vouchersUsed: monthRows.filter((row) => row.voucher_code).length,
            newStudents: Number(newStudents.recordset[0].n),
            monthly,
            sales: txs.recordset.slice(0, 12).map((row) => ({
                date: formatDate(new Date(row.created_at), lang),
                student: row.nickname,
                pkg: `${pick({ name: row.pkg_name, name_en: row.pkg_name_en }, 'name', lang)} ${row.hours}`,
                voucher: row.voucher_code || '—',
                amount: Number(row.net_amount),
                method: row.method,
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
        const isActive = req.body?.isActive === false ? 0 : 1;
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
        const isActive = req.body?.active === false || req.body?.status === 'disabled' ? 0 : 1;
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
            `SELECT m.*, u.nickname, b.public_id AS booking_public_id,
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
                 UPDATE dbo.bookings SET slot_id = @newSlot, status = 'confirmed', confirmed_at = SYSUTCDATETIME() WHERE id = @bookingId;
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
                `UPDATE dbo.bookings SET status = 'pending' WHERE id = @bookingId;
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
        const teacherId = req.user.role === 'teacher' ? req.user.id : await defaultTeacherId();
        const result = await query(
            `SELECT CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                    b.public_id AS booking_id, b.status AS booking_status, b.topic, b.topic_en,
                    u.nickname, u.name
             FROM dbo.teacher_availability s
             JOIN dbo.bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'confirmed', 'moved')
             JOIN dbo.users u ON u.id = b.user_id
             WHERE s.teacher_id = @teacherId AND s.slot_date >= @start AND s.slot_date <= @end
             ORDER BY s.slot_date, s.slot_time`,
            { teacherId, start: toIsoDate(start), end: toIsoDate(end) },
        );
        const lessonsByDate = {};
        let pendingCount = 0;
        for (const row of result.recordset) {
            const status = row.booking_status === 'confirmed' ? 'confirmed' : 'pending';
            if (status === 'pending') {
                pendingCount += 1;
            }
            const lesson = {
                bookingId: row.booking_id,
                time: row.slot_hhmm,
                student: lang === 'en' ? row.nickname : `น้อง${row.nickname}`,
                studentName: row.name,
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
        });
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
        const already = await query(`SELECT id FROM dbo.class_logs WHERE booking_id = @id`, { id: booking.id });
        if (already.recordset[0]) {
            throw new Error('บันทึกการสอนคลาสนี้แล้ว');
        }
        const pkg = booking.user_package_id
            ? { id: booking.user_package_id }
            : await activePackage(booking.user_id);
        await query(
            `INSERT INTO dbo.class_logs (booking_id, user_id, lesson_title, lesson_title_en, note, note_en, hours_deducted, outcome)
             VALUES (@bookingId, @userId, @title, @titleEn, @note, @noteEn, 1, @outcome);
             UPDATE dbo.bookings SET status = @status WHERE id = @bookingId;`,
            {
                bookingId: booking.id,
                userId: booking.user_id,
                title: booking.topic || 'เทคนิคการหายใจ + สเกลพื้นฐาน',
                titleEn: booking.topic_en || 'Breathing technique + basic scales',
                note,
                noteEn: null,
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
