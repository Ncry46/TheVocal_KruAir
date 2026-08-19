import bcrypt from 'bcryptjs';
import { asyncHandler, requireAuth, requireRole, signUser, toProfile } from './auth.js';
import { chipLabel, lessonTimeRange, parseIsoDate, plusOneHour, slotLabel, startOfWeekMonday, thaiDate, thaiMonthYear, toIsoDate } from './dates.js';
import {
    activePackage,
    addNotification,
    assertDayIso,
    defaultTeacherId,
    discountForVoucher,
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
        const inserted = await query(
            `INSERT INTO dbo.users (public_id, role, email, password_hash, name, nickname, age, education, genres, reason, consent_pdpa_at)
             OUTPUT INSERTED.*
             VALUES (@publicId, 'student', @email, @hash, @name, @nickname, @age, @education, @genres, @reason, SYSUTCDATETIME())`,
            {
                publicId: publicId('stu-'),
                email,
                hash,
                name: String(input.name),
                nickname: String(input.nickname),
                age: Number(input.age),
                education: String(input.education),
                genres: JSON.stringify(input.genres),
                reason: String(input.reason),
            },
        );
        const user = inserted.recordset[0];
        await addNotification(user.id, 'ยินดีต้อนรับ', 'สมัครสมาชิกสำเร็จ เริ่มต้นเรียนกับครูแอร์ได้เลย', 'blue');
        res.json({ token: signUser(user), user: toProfile(user) });
    }));

    app.get('/api/packages', asyncHandler(async (_req, res) => {
        const result = await query(`SELECT id, name, hours, price, note, tag, tone FROM dbo.packages WHERE is_active = 1 ORDER BY hours`);
        res.json(result.recordset.map((row) => ({
            ...row,
            price: Number(row.price),
        })));
    }));

    app.get('/api/days', requireAuth, asyncHandler(async (_req, res) => {
        const teacherId = await defaultTeacherId();
        const result = await query(
            `SELECT DISTINCT CONVERT(varchar(10), slot_date, 23) AS iso
             FROM dbo.teacher_availability
             WHERE teacher_id = @teacherId
               AND slot_date >= CONVERT(date, GETDATE())
               AND slot_date < DATEADD(day, 45, GETDATE())
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
            status: row.status === 'open' ? 'ว่าง' : 'เต็ม',
        })));
    }));

    app.get('/api/me/package-status', requireAuth, asyncHandler(async (req, res) => {
        res.json(packageStatusFromRow(await activePackage(req.user.id)));
    }));

    app.get('/api/booking-summary', requireAuth, asyncHandler(async (req, res) => {
        const day = assertDayIso(req.query.day);
        const time = String(req.query.time ?? '');
        const pkg = packageStatusFromRow(await activePackage(req.user.id));
        res.json({
            day: `${chipLabel(day)} ${thaiDate(day).split(' ').slice(0, 2).join(' ')}`,
            time: lessonTimeRange(time),
            teacher: 'ครูแอร์ (เรียนสด 1:1)',
            leftHours: pkg.left,
        });
    }));

    app.post('/api/bookings', requireAuth, asyncHandler(async (req, res) => {
        if (req.user.role !== 'student') {
            throw new Error('เฉพาะนักเรียนที่จองคิวได้');
        }
        const dayIso = String(req.body?.day ?? '');
        const time = String(req.body?.time ?? '');
        const day = assertDayIso(dayIso);
        const pkg = await activePackage(req.user.id);
        const status = packageStatusFromRow(pkg);
        if (status.left <= 0) {
            throw new Error('ชั่วโมงคงเหลือไม่พอ — กรุณาซื้อแพ็กเกจก่อนจอง');
        }
        const teacherId = await defaultTeacherId();
        const slot = await findSlot(dayIso, time, teacherId);
        if (!slot) {
            throw new Error('ไม่พบสล็อตที่เลือก');
        }
        if (slot.status !== 'open') {
            throw new Error('สล็อตนี้ถูกจองแล้ว');
        }
        const booking = await query(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, user_package_id, status, topic)
             OUTPUT INSERTED.*
             VALUES (@publicId, @userId, @slotId, @pkgId, 'pending', N'คอร์สตามแนวเพลงที่ชอบ');
             UPDATE dbo.teacher_availability SET status = 'booked' WHERE id = @slotId;`,
            { publicId: publicId('L'), userId: req.user.id, slotId: slot.id, pkgId: pkg.id },
        );
        await addNotification(
            req.user.id,
            'จองเวลาเรียนสำเร็จ',
            `ล็อกสล็อต ${slotLabel(day, time)} แล้ว — ระบบจะเตือนนัดก่อนเรียน 1 วัน`,
            'blue',
        );
        res.json({ id: booking.recordset[0].public_id });
    }));

    app.get('/api/me/lessons', requireAuth, asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT b.public_id, b.status, b.topic,
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
                date: chipLabel(date),
                time: lessonTimeRange(row.slot_hhmm),
                teacher: 'ครูแอร์ (เรียนสด 1:1)',
                status: row.status,
                topic: row.topic,
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
            `ยืนยันการมาเรียน ${chipLabel(date)} ${lessonTimeRange(lesson.slot_hhmm)} เรียบร้อย — แล้วพบกันนะครับ`,
            'green',
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
            `INSERT INTO dbo.move_requests (public_id, booking_id, user_id, requested_slot_id, from_text, to_text, status)
             VALUES (@publicId, @bookingId, @userId, @slotId, @fromText, @toText, 'pending');
             UPDATE dbo.bookings SET status = 'moved' WHERE id = @bookingId;`,
            {
                publicId: publicId('MR'),
                bookingId: lesson.id,
                userId: req.user.id,
                slotId: slot.id,
                fromText: slotLabel(fromDate, lesson.slot_hhmm),
                toText: slotLabel(toDate, newTime),
            },
        );
        await addNotification(
            req.user.id,
            'ส่งคำขอเลื่อนนัดแล้ว',
            `ขอเลื่อนนัดเป็น ${slotLabel(toDate, newTime)} — ครูแอร์จะยืนยันอีกครั้งภายใน 24 ชม.`,
            'blue',
        );
        res.json({ ok: true });
    }));

    app.get('/api/me/history', requireAuth, asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT cl.lesson_title, cl.note, cl.hours_deducted, cl.outcome, cl.created_at,
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
            return {
                date: chipLabel(date),
                time: `${row.slot_hhmm}–${plusOneHour(row.slot_hhmm)}`,
                lesson: row.outcome === 'no_show' ? 'No-show (ไม่มาเรียน)' : row.lesson_title,
                note: row.note || '—',
                usedHours: row.hours_deducted,
            };
        }));
    }));

    app.get('/api/me/receipts', requireAuth, asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT t.ref_no, t.created_at, t.voucher_code, t.discount_amount, t.net_amount, t.method, t.status, p.name AS pkg_name, p.hours
             FROM dbo.transactions t
             JOIN dbo.packages p ON p.id = t.package_id
             WHERE t.user_id = @userId
             ORDER BY t.created_at DESC`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map((row) => ({
            id: row.ref_no,
            date: thaiDate(new Date(row.created_at)),
            pkg: `${row.pkg_name} ${row.hours} ชม.`,
            voucher: row.voucher_code ? `${row.voucher_code} (-${Number(row.discount_amount).toLocaleString()})` : '—',
            amount: Number(row.net_amount),
            method: row.method,
            status: row.status === 'success' ? 'สำเร็จ' : row.status,
        })));
    }));

    app.get('/api/notifications', requireAuth, asyncHandler(async (req, res) => {
        const result = await query(
            `SELECT TOP 20 * FROM dbo.notifications WHERE user_id = @userId ORDER BY created_at DESC`,
            { userId: req.user.id },
        );
        res.json(result.recordset.map(mapNotification));
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
        res.json({ discount: discountForVoucher(voucher, price) });
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
            discount = discountForVoucher(voucher, pkg.price);
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
        await addNotification(req.user.id, 'ชำระเงินสำเร็จ', `ซื้อแพ็กเกจ ${pkg.name} — เพิ่มชั่วโมงเข้าบัญชีแล้ว`, 'green');
        res.json({ ok: true, refNo });
    }));

    app.get('/api/admin/students', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (_req, res) => {
        const result = await query(
            `SELECT u.name, u.nickname, u.age, u.education, u.created_at,
                    p.name AS pkg_name, p.hours AS pkg_hours,
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
                pkg: row.pkg_name ? `${row.pkg_name} ${row.pkg_hours}` : '—',
                left,
                done: row.done,
                state,
            };
        }));
    }));

    app.get('/api/admin/sales', requireAuth, requireRole(['admin']), asyncHandler(async (_req, res) => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const txs = await query(
            `SELECT t.*, u.nickname, p.name AS pkg_name, p.hours
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
                label: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][cursor.getMonth()],
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
                date: thaiDate(new Date(row.created_at)),
                student: row.nickname,
                pkg: `${row.pkg_name} ${row.hours}`,
                voucher: row.voucher_code || '—',
                amount: Number(row.net_amount),
                method: row.method,
            })),
        });
    }));

    app.get('/api/admin/vouchers', requireAuth, requireRole(['admin']), asyncHandler(async (_req, res) => {
        const result = await query(`SELECT * FROM dbo.vouchers ORDER BY id DESC`);
        res.json(result.recordset.map((row) => ({
            code: row.code,
            type: row.type === 'percent'
                ? `% ${Number(row.value)}% (สูงสุด ${Number(row.max_discount).toLocaleString()})`
                : `บาท ${Number(row.value).toLocaleString()}`,
            expires: row.valid_to ? thaiDate(new Date(row.valid_to)) : '—',
            used: `${row.used_count} / ${row.max_uses ?? '—'}`,
            state: row.is_active ? 'active' : 'draft',
        })));
    }));

    app.post('/api/admin/vouchers', requireAuth, requireRole(['admin']), asyncHandler(async (req, res) => {
        const code = String(req.body?.code ?? '').trim().toUpperCase();
        if (!code) {
            throw new Error('กรุณาระบุโค้ดวอเชอร์');
        }
        await query(
            `INSERT INTO dbo.vouchers (code, type, value, is_active) VALUES (@code, 'fixed', 500, 0)`,
            { code },
        );
        res.json({ ok: true });
    }));

    app.get('/api/admin/move-requests', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (_req, res) => {
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
        res.json(result.recordset.map(mapMoveRequest));
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
            await addNotification(row.student_id, 'อนุมัติเลื่อนนัดแล้ว', `เลื่อนนัดเป็น ${row.to_text} เรียบร้อย — อัปเดตตารางเรียนแล้ว`, 'green');
        }
        else {
            await query(
                `UPDATE dbo.bookings SET status = 'pending' WHERE id = @bookingId;
                 UPDATE dbo.move_requests SET status = 'rejected', decided_by = @decidedBy, decided_at = SYSUTCDATETIME() WHERE id = @id;`,
                { bookingId: row.booking_row_id, decidedBy: req.user.id, id: row.id },
            );
            await addNotification(row.student_id, 'ปฏิเสธคำขอเลื่อนนัด', 'ครูแอร์ยังสะดวกเวลานัดเดิม — ติดต่อครูแอร์เพื่อปรึกษาเวลาใหม่ได้เลย', 'pink');
        }
        res.json({ ok: true });
    }));

    app.get('/api/teacher/schedule', requireAuth, requireRole(['teacher', 'admin']), asyncHandler(async (_req, res) => {
        const start = startOfWeekMonday();
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        const teacherId = await defaultTeacherId();
        const result = await query(
            `SELECT CONVERT(varchar(10), s.slot_date, 23) AS slot_iso,
                    CONVERT(varchar(5), s.slot_time, 108) AS slot_hhmm,
                    s.status AS slot_status,
                    b.public_id AS booking_id, b.status AS booking_status, b.topic,
                    u.nickname
             FROM dbo.teacher_availability s
             LEFT JOIN dbo.bookings b ON b.slot_id = s.id AND b.status IN ('pending', 'confirmed', 'moved')
             LEFT JOIN dbo.users u ON u.id = b.user_id
             WHERE s.teacher_id = @teacherId AND s.slot_date >= @start AND s.slot_date <= @end`,
            { teacherId, start: toIsoDate(start), end: toIsoDate(end) },
        );
        const days = [];
        const cells = {};
        let pendingCount = 0;
        for (let i = 0; i < 7; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() + i);
            days.push({
                key: chipLabel(date).split(' ')[0],
                date: String(date.getDate()),
                iso: toIsoDate(date),
            });
        }
        for (const row of result.recordset) {
            if (!row.booking_id) {
                continue;
            }
            const date = parseIsoDate(row.slot_iso);
            const dayKey = chipLabel(date).split(' ')[0];
            const status = row.booking_status === 'confirmed' ? 'confirmed' : 'pending';
            if (status === 'pending') {
                pendingCount += 1;
            }
            cells[`${dayKey}|${row.slot_hhmm}`] = {
                bookingId: row.booking_id,
                student: `น้อง${row.nickname}`,
                lesson: row.topic || 'คอร์สตามแนวเพลงที่ชอบ',
                status,
            };
        }
        res.json({
            title: `ตารางสอน · สัปดาห์ ${start.getDate()}–${end.getDate()} ${thaiMonthYear(start)}`,
            days,
            times: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            cells,
            pendingCount,
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
            `INSERT INTO dbo.class_logs (booking_id, user_id, lesson_title, note, hours_deducted, outcome)
             VALUES (@bookingId, @userId, @title, @note, 1, @outcome);
             UPDATE dbo.bookings SET status = @status WHERE id = @bookingId;`,
            {
                bookingId: booking.id,
                userId: booking.user_id,
                title: booking.topic || 'เทคนิคการหายใจ + สเกลพื้นฐาน',
                note,
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
        );
        res.json({ ok: true });
    }));
}

export { publicId };
