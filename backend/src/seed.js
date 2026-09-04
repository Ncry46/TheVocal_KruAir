import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { toIsoDate } from './dates.js';
import { closePool } from './db.js';
import { educationEn, genresEn } from './lang.js';
import { query, toYn, ensureTeacherAvailability } from './store.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../../data');
function loadJson(name) {
    return JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

async function insertUser(row) {
    const hash = await bcrypt.hash(row.password, 10);
    const result = await query(
        `INSERT INTO dbo.users (role, email, phone, emergency_contact, password_hash, name, name_en, nickname, nickname_en, age, education, education_en, genres, genres_en, reason, reason_en, line_linked, avatar, consent_pdpa_at)
         OUTPUT INSERTED.id
         VALUES (@role, @email, @phone, @emergency, @hash, @name, @nameEn, @nickname, @nicknameEn, @age, @education, @educationEn, @genres, @genresEn, @reason, @reasonEn, @lineLinked, @avatar, SYSUTCDATETIME())`,
        {
            role: row.role,
            email: row.email,
            phone: row.phone ?? null,
            emergency: row.emergencyContact ?? null,
            hash,
            name: row.name,
            nameEn: row.nameEn ?? row.name,
            nickname: row.nickname,
            nicknameEn: row.nicknameEn ?? row.nickname,
            age: row.age,
            education: row.education,
            educationEn: educationEn(row.education),
            genres: JSON.stringify(row.genres),
            genresEn: JSON.stringify(genresEn(row.genres)),
            reason: row.reason,
            reasonEn: null,
            lineLinked: toYn(row.lineLinked),
            avatar: row.avatar ?? null,
        },
    );
    return result.recordset[0].id;
}

async function seed() {
    const existing = await query(`SELECT COUNT(*) AS n FROM dbo.users`);
    if (Number(existing.recordset[0].n) > 0) {
        console.log('Seed skipped: users already exist');
        return;
    }

    const packages = loadJson('packages.json');
    for (const pkg of packages) {
        await query(
            `INSERT INTO dbo.packages (id, name, name_en, hours, price, note, note_en, tag, tone, is_active)
             VALUES (@id, @name, @nameEn, @hours, @price, @note, @noteEn, @tag, @tone, @isActive)`,
            {
                id: pkg.id,
                name: pkg.name,
                nameEn: pkg.nameEn ?? pkg.name,
                hours: pkg.hours,
                price: pkg.price,
                note: pkg.note,
                noteEn: pkg.noteEn ?? pkg.note,
                tag: pkg.tag,
                tone: pkg.tone,
                isActive: toYn(pkg.isActive !== false),
            },
        );
    }

    const vouchers = loadJson('vouchers.json');
    for (const voucher of vouchers) {
        await query(
            `INSERT INTO dbo.vouchers (code, type, value, max_discount, valid_to, max_uses, used_count, is_active)
             VALUES (@code, @type, @value, @maxDiscount, @validTo, @maxUses, @usedCount, @isActive)`,
            {
                code: voucher.code,
                type: voucher.type,
                value: voucher.value,
                maxDiscount: voucher.maxDiscount,
                validTo: voucher.validTo,
                maxUses: voucher.maxUses,
                usedCount: voucher.usedCount,
                isActive: toYn(voucher.isActive),
            },
        );
    }

    const ids = {};
    for (const account of loadJson('accounts.json')) {
        ids[account.publicId] = await insertUser(account);
    }
    const mintId = ids['stu-001'];
    const teacherId = ids['tch-001'];
    const fernId = ids['stu-002'];
    const minId = ids['stu-003'];
    const tonId = ids['stu-004'];

    const mintExpires = addDays(new Date(), 180);
    const mintPkg = await query(
        `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status)
         OUTPUT INSERTED.id
         VALUES (@userId, 'pro', 20, 1, @expires, 'active')`,
        { userId: mintId, expires: mintExpires.toISOString() },
    );
    await query(
        `INSERT INTO dbo.user_packages (user_id, package_id, hours_total, hours_used, expires_at, status)
         VALUES
         (@fern, 'pro', 20, 5, @expires, 'active'),
         (@min, 'beginner', 10, 2, @expires, 'active'),
         (@ton, 'master', 30, 0, @expires, 'active')`,
        { fern: fernId, min: minId, ton: tonId, expires: mintExpires.toISOString() },
    );

    await query(
        `INSERT INTO dbo.transactions (ref_no, user_id, package_id, gross_amount, discount_amount, net_amount, voucher_code, method, method_en, status, paid_at)
         VALUES
         ('INV-2026-8801', @mint, 'pro', 40000, 3000, 37000, 'WELCOME10', N'บัตรเครดิต', N'Credit card', 'success', SYSUTCDATETIME()),
         ('INV-2026-8800', @mint, 'beginner', 22000, 0, 22000, NULL, N'KBank', N'KBank', 'success', DATEADD(month, -1, SYSUTCDATETIME())),
         ('INV-2026-8802', @fern, 'pro', 40000, 1000, 39000, 'SAVE1000', N'KBank', N'KBank', 'success', SYSUTCDATETIME()),
         ('INV-2026-8803', @min, 'beginner', 22000, 0, 22000, NULL, N'บัตรเครดิต', N'Credit card', 'success', DATEADD(day, -3, SYSUTCDATETIME())),
         ('INV-2026-8804', @ton, 'master', 56000, 1000, 55000, 'SAVE1000', N'KBank', N'KBank', 'success', DATEADD(day, -8, SYSUTCDATETIME()))`,
        { mint: mintId, fern: fernId, min: minId, ton: tonId },
    );

    const times = ['10:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let offset = 0; offset < 21; offset += 1) {
        const date = addDays(today, offset);
        if (date.getDay() === 0) {
            continue;
        }
        for (const time of times) {
            await query(
                `INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, status)
                 VALUES (@teacherId, @slotDate, @slotTime, 'open')`,
                { teacherId, slotDate: toIsoDate(date), slotTime: time },
            );
        }
    }

    const slotFor = async (daysAhead, time) => {
        const date = addDays(today, daysAhead);
        const result = await query(
            `SELECT id FROM dbo.teacher_availability
             WHERE teacher_id = @teacherId AND slot_date = @slotDate AND CONVERT(varchar(5), slot_time, 108) = @time`,
            { teacherId, slotDate: toIsoDate(date), time },
        );
        return result.recordset[0]?.id;
    };

    const mintSlot = await slotFor(1, '17:00');
    const minSlot = await slotFor(1, '11:00');
    const fernSlot = await slotFor(2, '10:00');
    if (mintSlot) {
        const booking = await query(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, user_package_id, status, topic, source, mode, confirm_deadline, updated_at)
             OUTPUT INSERTED.id
             VALUES ('L-mint-next', @userId, @slotId, @pkgId, 'pending', N'เทคนิคการหายใจ + สเกลพื้นฐาน', N'web', N'studio', DATEADD(hour, 24, SYSUTCDATETIME()), SYSUTCDATETIME());
             UPDATE dbo.teacher_availability SET status = 'booked' WHERE id = @slotId;`,
            { userId: mintId, slotId: mintSlot, pkgId: mintPkg.recordset[0].id },
        );
        await query(
            `INSERT INTO dbo.notifications (public_id, user_id, title, body, tone)
             VALUES ('N-welcome', @userId, N'ยินดีต้อนรับ', N'สมัครสมาชิกสำเร็จ เริ่มต้นเรียนกับครูแอร์ได้เลย', 'blue'),
                    ('N-pay', @userId, N'ชำระเงินสำเร็จ', N'ซื้อแพ็กเกจ Pro 20 ชม. — เพิ่มชั่วโมงเข้าบัญชีแล้ว', 'green'),
                    ('N-remind', @userId, N'เตือนนัดเรียนพรุ่งนี้', N'พรุ่งนี้ 17:00 น. มีคลาสเรียน — กดยืนยันการมาเรียนก่อนเข้าเรียน 1 วัน', 'pink')`,
            { userId: mintId },
        );
        void booking;
    }
    if (minSlot) {
        await query(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, status, topic, source, mode, confirm_deadline, updated_at)
             VALUES ('L-min-next', @userId, @slotId, 'pending', N'Ballad', N'web', N'studio', DATEADD(hour, 24, SYSUTCDATETIME()), SYSUTCDATETIME());
             UPDATE dbo.teacher_availability SET status = 'booked' WHERE id = @slotId;`,
            { userId: minId, slotId: minSlot },
        );
    }
    if (fernSlot) {
        await query(
            `INSERT INTO dbo.bookings (public_id, user_id, slot_id, status, topic, source, mode, confirm_deadline, confirmed_at, updated_at)
             VALUES ('L-fern-next', @userId, @slotId, 'confirmed', N'Pop + สเกล', N'web', N'studio', DATEADD(hour, 24, SYSUTCDATETIME()), SYSUTCDATETIME(), SYSUTCDATETIME());
             UPDATE dbo.teacher_availability SET status = 'booked' WHERE id = @slotId;`,
            { userId: fernId, slotId: fernSlot },
        );
    }

    const pastDate = addDays(today, -7);
    const pastSlot = await query(
        `INSERT INTO dbo.teacher_availability (teacher_id, slot_date, slot_time, status)
         OUTPUT INSERTED.id
         VALUES (@teacherId, @slotDate, '17:00', 'booked')`,
        { teacherId, slotDate: toIsoDate(pastDate) },
    );
    const pastBooking = await query(
        `INSERT INTO dbo.bookings (public_id, user_id, slot_id, user_package_id, status, topic, source, mode, confirm_deadline, updated_at)
         OUTPUT INSERTED.id
         VALUES ('L-mint-past', @userId, @slotId, @pkgId, 'done', N'เทคนิคการหายใจ + สเกลพื้นฐาน', N'web', N'studio', DATEADD(hour, -6, SYSUTCDATETIME()), SYSUTCDATETIME())`,
        { userId: mintId, slotId: pastSlot.recordset[0].id, pkgId: mintPkg.recordset[0].id },
    );
    await query(
        `INSERT INTO dbo.class_logs (booking_id, user_id, lesson_title, note, hours_deducted, outcome)
         VALUES (@bookingId, @userId, N'เทคนิคการหายใจ + สเกลพื้นฐาน', N'เสียงดีขึ้นมาก ฝึก C3–C5', 1, 'done')`,
        { bookingId: pastBooking.recordset[0].id, userId: mintId },
    );

    if (ids['tch-002']) {
        await ensureTeacherAvailability(ids['tch-002']);
    }

    console.log('Seed completed for BD_AIR');
    await closePool();
}

seed().catch(async (err) => {
    console.error(err);
    await closePool().catch(() => {});
    process.exit(1);
});
