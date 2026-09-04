import { Link } from 'react-router-dom';
import { PublicLayout } from '@components/layout/PublicLayout';
import { useApp } from '../context/AppContext';

export default function Terms() {
  const { language } = useApp();
  const th = language === 'th';

  return (
    <PublicLayout>
      <main className="legal-page">
        <div className="wrap legal-inner">
          <p className="legal-kicker">{th ? 'เอกสารทางกฎหมาย' : 'Legal'}</p>
          <h1>{th ? 'เงื่อนไขการใช้บริการ' : 'Terms of Service'}</h1>
          <p className="legal-updated">
            {th ? 'อัปเดตล่าสุด: 3 กันยายน 2026' : 'Last updated: 3 September 2026'}
          </p>

          <section>
            <h2>{th ? '1. การยอมรับเงื่อนไข' : '1. Acceptance'}</h2>
            <p>
              {th
                ? 'การใช้เว็บไซต์ VOCALITY ACADEMY BY KRU AIR ถือว่าคุณยอมรับเงื่อนไขฉบับนี้ หากไม่ยอมรับ กรุณาหยุดใช้บริการ'
                : 'By using VOCALITY ACADEMY BY KRU AIR, you agree to these terms. If you do not agree, please discontinue use.'}
            </p>
          </section>

          <section>
            <h2>{th ? '2. บริการ' : '2. Service'}</h2>
            <p>
              {th
                ? 'แพลตฟอร์มนี้ใช้สำหรับจองคลาสเรียนร้องเพลงตัวต่อตัวกับครูแอร์ จัดการชั่วโมง ชำระเงินผ่านการโอน และรับการแจ้งเตือนที่เกี่ยวข้อง'
                : 'This platform is for booking one-on-one vocal lessons with Kru Air, managing lesson hours, paying by bank transfer, and receiving related notifications.'}
            </p>
          </section>

          <section>
            <h2>{th ? '3. บัญชีผู้ใช้' : '3. Accounts'}</h2>
            <ul>
              <li>{th ? 'คุณต้องให้ข้อมูลที่ถูกต้องและรักษาความลับของบัญชี' : 'You must provide accurate information and keep your account secure.'}</li>
              <li>{th ? 'ห้ามแชร์บัญชีหรือใช้บัญชีของผู้อื่นโดยไม่ได้รับอนุญาต' : 'Do not share accounts or use another person’s account without permission.'}</li>
              <li>{th ? 'เราอาจระงับบัญชีหากพบการใช้งานที่ผิดปกติหรือละเมิดเงื่อนไข' : 'We may suspend accounts for misuse or breach of these terms.'}</li>
            </ul>
          </section>

          <section>
            <h2>{th ? '4. แพ็กเกจและการชำระเงิน' : '4. Packages and payment'}</h2>
            <ul>
              <li>{th ? 'นับชั่วโมงเมื่อเข้ารับจริง 1 ชั่วโมงต่อครั้ง' : 'Hours are counted upon actual attendance: 1 hour per session.'}</li>
              <li>{th ? 'แพ็กเกจมีอายุ 6 เดือน นับจากวันที่ซื้อ' : 'Packages expire 6 months after purchase.'}</li>
              <li>{th ? 'ไม่สามารถโอนสิทธิ์หรือคืนเงินได้ เว้นแต่กฎหมายกำหนดเป็นอย่างอื่น' : 'Packages are non-transferable and non-refundable except where required by law.'}</li>
              <li>{th ? 'ใช้ได้เฉพาะคอร์สของครูแอร์เท่านั้น' : 'Valid only for Kru Air courses.'}</li>
              <li>
                {th
                  ? 'ชำระเงินผ่านพร้อมเพย์/ธนาคาร แล้วรอครูแอร์ยืนยันรับเงินก่อนเพิ่มชั่วโมง'
                  : 'Pay via PromptPay/bank transfer; hours are added after Kru Air confirms payment.'}
              </li>
            </ul>
          </section>

          <section>
            <h2>{th ? '5. การจองและการยกเลิก' : '5. Booking and cancellation'}</h2>
            <p>
              {th
                ? 'นักเรียนสามารถจองเวลาว่างตามที่ระบบแสดง หากต้องการเลื่อนหรือยกเลิก ให้ดำเนินการตามช่องทางและเงื่อนไขที่โรงเรียนกำหนด การไม่มาเรียนโดยไม่แจ้งอาจถูกตัดชั่วโมงตามนโยบายของโรงเรียน'
                : 'Students may book available slots shown in the system. Reschedules/cancellations follow school policy. No-shows may result in hour deduction according to academy rules.'}
            </p>
          </section>

          <section>
            <h2>{th ? '6. การเชื่อมต่อ Google และ LINE' : '6. Google and LINE integrations'}</h2>
            <p>
              {th
                ? 'ฟีเจอร์ซิงก์ปฏิทินและแจ้งเตือน LINE เป็นบริการเสริม ผู้ใช้สามารถเชื่อมต่อหรือยกเลิกได้เอง การใช้งานขึ้นอยู่กับนโยบายของ Google และ LINE ด้วย'
                : 'Calendar sync and LINE notifications are optional features. Users may connect or disconnect at any time. Use is also subject to Google and LINE policies.'}
            </p>
          </section>

          <section>
            <h2>{th ? '7. ข้อจำกัดความรับผิด' : '7. Limitation of liability'}</h2>
            <p>
              {th
                ? 'เราพยายามให้บริการอย่างต่อเนื่อง แต่ไม่รับประกันว่าจะไม่มีข้อขัดข้องทางเทคนิค ความรับผิดของเราจำกัดเท่าที่กฎหมายอนุญาต'
                : 'We aim for reliable service but do not guarantee uninterrupted availability. Our liability is limited to the extent permitted by law.'}
            </p>
          </section>

          <section>
            <h2>{th ? '8. การเปลี่ยนแปลงเงื่อนไข' : '8. Changes'}</h2>
            <p>
              {th
                ? 'เราอาจปรับปรุงเงื่อนไขนี้เป็นครั้งคราว โดยประกาศวันที่อัปเดตบนหน้านี้'
                : 'We may update these terms from time to time and will post the revised date on this page.'}
            </p>
          </section>

          <section>
            <h2>{th ? '9. ติดต่อ' : '9. Contact'}</h2>
            <p>
              {th ? 'สอบถามเรื่องเงื่อนไขการใช้บริการ: ' : 'Questions about these terms: '}
              <a href="mailto:businessdev@thanvasu.com">businessdev@thanvasu.com</a>
            </p>
          </section>

          <p className="legal-back">
            <Link to="/">{th ? '← กลับหน้าแรก' : '← Back to home'}</Link>
            {' · '}
            <Link to="/privacy">{th ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy'}</Link>
          </p>
        </div>
      </main>
    </PublicLayout>
  );
}
