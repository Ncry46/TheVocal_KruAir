import { closePool } from './db.js';
import { query } from './store.js';

async function seedI18n() {
    await query(
        `UPDATE dbo.packages SET
            name_en = N'10-hour package',
            note_en = N'About ฿2,200/hour · great for beginners',
            tag_en = NULL
         WHERE id = 'beginner';
         UPDATE dbo.packages SET
            name_en = N'20-hour package',
            note_en = N'About ฿2,000/hour · best for committed students',
            tag_en = N'Popular'
         WHERE id = 'pro';
         UPDATE dbo.packages SET
            name_en = N'30-hour package',
            note_en = N'About ฿1,867/hour',
            tag_en = N'Best value'
         WHERE id = 'master';`,
    );

    await query(
        `UPDATE dbo.notifications SET title_en = N'Welcome', body_en = N'Your account is ready. You can start learning with Kru Air.'
         WHERE title = N'ยินดีต้อนรับ' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Payment successful', body_en = N'Pro 20-hour package purchased — hours were added to your account.'
         WHERE title = N'ชำระเงินสำเร็จ' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Reminder: lesson tomorrow', body_en = N'Tomorrow at 17:00 you have a lesson — confirm attendance 1 day before class.'
         WHERE title = N'เตือนนัดเรียนพรุ่งนี้' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Booking confirmed', body_en = N'Your lesson slot is locked. You will get a reminder 1 day before class.'
         WHERE title = N'จองเวลาเรียนสำเร็จ' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Attendance confirmed', body_en = N'Your attendance is confirmed — see you soon.'
         WHERE title = N'ยืนยันนัดเรียนแล้ว' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Move request sent', body_en = N'Kru Air will confirm the new time within 24 hours.'
         WHERE title = N'ส่งคำขอเลื่อนนัดแล้ว' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Move approved', body_en = N'Your lesson time was updated.'
         WHERE title = N'อนุมัติเลื่อนนัดแล้ว' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Move request declined', body_en = N'Kru Air is keeping the original time. Please contact the teacher to discuss a new slot.'
         WHERE title = N'ปฏิเสธคำขอเลื่อนนัด' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Lesson recorded', body_en = N'Kru Air recorded the class and deducted 1 hour.'
         WHERE title = N'บันทึกการเรียนแล้ว' AND title_en IS NULL;
         UPDATE dbo.notifications SET title_en = N'Marked as no-show', body_en = N'Marked as no-show and deducted 1 hour per package terms.'
         WHERE title = N'บันทึกว่าไม่มาเรียน' AND title_en IS NULL;`,
    );

    await query(
        `UPDATE dbo.bookings SET topic_en = N'Breathing technique + basic scales'
         WHERE topic = N'เทคนิคการหายใจ + สเกลพื้นฐาน' AND topic_en IS NULL;
         UPDATE dbo.bookings SET topic_en = N'Ballad'
         WHERE topic = N'Ballad' AND topic_en IS NULL;
         UPDATE dbo.bookings SET topic_en = N'Pop + scales'
         WHERE topic LIKE N'Pop%' AND topic_en IS NULL;`,
    );

    await query(
        `UPDATE dbo.class_logs SET
            lesson_title_en = N'Breathing technique + basic scales',
            note_en = N'Voice is improving. Practice C3–C5.'
         WHERE lesson_title = N'เทคนิคการหายใจ + สเกลพื้นฐาน' AND lesson_title_en IS NULL;`,
    );

    await query(
        `UPDATE dbo.users SET avatar = N'/img/av-1.jpg' WHERE email = N'mint@email.com';
         UPDATE dbo.users SET avatar = N'/img/teacher-studio.jpg' WHERE email = N'kruaer@email.com';
         UPDATE dbo.users SET avatar = N'/img/av-3.jpg' WHERE email = N'admin@kruaer.com';
         UPDATE dbo.users SET avatar = N'/img/av-2.jpg' WHERE email = N'fern@email.com';
         UPDATE dbo.users SET avatar = N'/img/av-3.jpg' WHERE email = N'min@email.com';
         UPDATE dbo.users SET avatar = N'/img/av-1.jpg' WHERE email = N'tonnam@email.com';
         UPDATE dbo.users SET avatar = N'/img/av-2.jpg' WHERE email = N'prim@email.com';`,
    );

    console.log('Bilingual content ready in BD_AIR');
    await closePool();
}

seedI18n().catch(async (err) => {
    console.error(err);
    await closePool().catch(() => {});
    process.exit(1);
});
