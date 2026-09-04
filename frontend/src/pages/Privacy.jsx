import { Link } from 'react-router-dom';
import { PublicLayout } from '@components/layout/PublicLayout';
import { useApp } from '../context/AppContext';

export default function Privacy() {
  const { language } = useApp();
  const th = language === 'th';

  return (
    <PublicLayout>
      <main className="legal-page">
        <div className="wrap legal-inner">
          <p className="legal-kicker">{th ? 'เอกสารทางกฎหมาย' : 'Legal'}</p>
          <h1>{th ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}</h1>
          <p className="legal-updated">
            {th ? 'อัปเดตล่าสุด: 3 กันยายน 2026' : 'Last updated: 3 September 2026'}
          </p>

          <section>
            <h2>{th ? '1. ข้อมูลของเรา' : '1. Who we are'}</h2>
            <p>
              {th
                ? 'เว็บไซต์ VOCALITY ACADEMY BY KRU AIR (https://kruair.thanvasupos.com) เป็นระบบจัดการเรียนร้องเพลงตัวต่อตัว ดำเนินการโดย VOCALITY ACADEMY BY KRU AIR'
                : 'VOCALITY ACADEMY BY KRU AIR (https://kruair.thanvasupos.com) is a one-on-one vocal lesson management platform operated by VOCALITY ACADEMY BY KRU AIR.'}
            </p>
            <p>
              {th ? 'ติดต่อเรื่องข้อมูลส่วนบุคคล: ' : 'Privacy contact: '}
              <a href="mailto:businessdev@thanvasu.com">businessdev@thanvasu.com</a>
            </p>
          </section>

          <section>
            <h2>{th ? '2. ข้อมูลที่เราเก็บ' : '2. Information we collect'}</h2>
            <ul>
              <li>
                {th
                  ? 'ข้อมูลบัญชี: ชื่อ เบอร์โทร อีเมล (ถ้ามี) รหัสผ่านที่เข้ารหัส และรูปโปรไฟล์'
                  : 'Account data: name, phone, email (if provided), hashed password, and profile photo'}
              </li>
              <li>
                {th
                  ? 'ข้อมูลการเรียน: การจองคลาส ประวัติเข้าเรียน ชั่วโมงคงเหลือ การบ้าน และลายเซ็นยืนยันหลังเรียน'
                  : 'Lesson data: bookings, attendance, remaining hours, homework, and post-lesson signatures'}
              </li>
              <li>
                {th
                  ? 'ข้อมูลการชำระเงิน: หลักฐานโอนเงิน แพ็กเกจที่ซื้อ และสถานะการยืนยันรับเงิน (ไม่เก็บหมายเลขบัตรเครดิต)'
                  : 'Payment data: transfer slips, purchased packages, and confirmation status (we do not store credit card numbers)'}
              </li>
              <li>
                {th
                  ? 'การเชื่อมต่อภายนอก (ถ้าผู้ใช้ยินยอม): LINE User ID และโทเค็น Google Calendar เพื่อซิงก์ตารางเรียน'
                  : 'Third-party connections (with consent): LINE User ID and Google Calendar tokens to sync lesson schedules'}
              </li>
              <li>
                {th
                  ? 'ข้อมูลการใช้งานพื้นฐาน เช่น บันทึกการเข้าสู่ระบบเพื่อความปลอดภัยของระบบ'
                  : 'Basic usage/security logs such as sign-in activity'}
              </li>
            </ul>
          </section>

          <section>
            <h2>{th ? '3. วัตถุประสงค์การใช้ข้อมูล' : '3. How we use your data'}</h2>
            <ul>
              <li>{th ? 'จัดการบัญชีผู้ใช้และสิทธิ์การเข้าถึง' : 'Manage accounts and access permissions'}</li>
              <li>{th ? 'จองคลาส ยืนยันการเข้าเรียน และตัดชั่วโมง' : 'Book lessons, confirm attendance, and deduct hours'}</li>
              <li>{th ? 'ยืนยันการชำระเงินและออกใบเสร็จ' : 'Confirm payments and issue receipts'}</li>
              <li>
                {th
                  ? 'ส่งการแจ้งเตือนผ่านเว็บและ LINE (เช่น แจ้งเตือนก่อนเรียน 1 วัน)'
                  : 'Send in-app and LINE notifications (for example, day-before lesson reminders)'}
              </li>
              <li>
                {th
                  ? 'ซิงก์ตารางเรียนไปยัง Google Calendar เมื่อผู้ใช้เชื่อมต่อบัญชี Google'
                  : 'Sync lesson events to Google Calendar when a user connects Google'}
              </li>
              <li>{th ? 'ปรับปรุงความปลอดภัยและความเสถียรของระบบ' : 'Maintain security and system reliability'}</li>
            </ul>
          </section>

          <section>
            <h2>{th ? '4. Google Calendar' : '4. Google Calendar'}</h2>
            <p>
              {th
                ? 'หากคุณเชื่อมต่อ Google ระบบจะขอสิทธิ์สร้าง/แก้ไข/ลบกิจกรรมในปฏิทินของคุณเฉพาะที่เกี่ยวกับตารางเรียนของ VOCALITY เท่านั้น เราไม่ใช้ข้อมูลปฏิทินเพื่อโฆษณา และคุณสามารถยกเลิกการเชื่อมต่อได้ทุกเมื่อในหน้าโปรไฟล์หรือการตั้งค่า'
                : 'If you connect Google, we request permission only to create/update/delete calendar events related to VOCALITY lessons. We do not use calendar data for advertising. You can disconnect anytime from Profile or Settings.'}
            </p>
          </section>

          <section>
            <h2>{th ? '5. การเปิดเผยข้อมูล' : '5. Sharing of data'}</h2>
            <p>
              {th
                ? 'เราไม่ขายข้อมูลส่วนบุคคล เราอาจเปิดเผยข้อมูลเท่าที่จำเป็นแก่ผู้ให้บริการที่ช่วยให้ระบบทำงาน เช่น Google (Calendar) และ LINE Messaging API รวมถึงกรณีที่กฎหมายกำหนด'
                : 'We do not sell personal data. We may share limited data with service providers required to operate the platform, such as Google (Calendar) and LINE Messaging API, or when required by law.'}
            </p>
          </section>

          <section>
            <h2>{th ? '6. การเก็บรักษาและความปลอดภัย' : '6. Retention and security'}</h2>
            <p>
              {th
                ? 'เราเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการและข้อกำหนดทางธุรกิจ/กฎหมาย ใช้มาตรการที่เหมาะสมเพื่อป้องกันการเข้าถึงโดยไม่ได้รับอนุญาต เช่น การเข้ารหัสรหัสผ่านและการควบคุมสิทธิ์ผู้ใช้'
                : 'We retain data as needed to provide the service and meet business/legal requirements. We apply reasonable safeguards such as password hashing and role-based access control.'}
            </p>
          </section>

          <section>
            <h2>{th ? '7. สิทธิของเจ้าของข้อมูล' : '7. Your rights'}</h2>
            <p>
              {th
                ? 'ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) คุณมีสิทธิขอเข้าถึง แก้ไข ลบ หรือถอนความยินยอมการใช้ข้อมูลส่วนบุคคลได้ โดยติดต่อ businessdev@thanvasu.com'
                : 'Under Thailand PDPA, you may request access, correction, deletion, or withdrawal of consent by contacting businessdev@thanvasu.com.'}
            </p>
          </section>

          <section>
            <h2>{th ? '8. การเปลี่ยนแปลงนโยบาย' : '8. Policy updates'}</h2>
            <p>
              {th
                ? 'เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยจะอัปเดตวันที่ด้านบนของหน้านี้'
                : 'We may update this policy from time to time and will revise the date at the top of this page.'}
            </p>
          </section>

          <p className="legal-back">
            <Link to="/">{th ? '← กลับหน้าแรก' : '← Back to home'}</Link>
            {' · '}
            <Link to="/terms">{th ? 'เงื่อนไขการใช้บริการ' : 'Terms of Service'}</Link>
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}
