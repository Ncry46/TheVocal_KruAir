import { Badge, Card } from '@components/ui';
function Row({ k, v }) {
    return (<div className="info-row">
      <span className="muted">{k}</span>
      <b>{v}</b>
    </div>);
}
export default function Settings() {
    return (<div className="grid cols-2">
      <Card title="แพ็กเกจ">
        <Row k="Beginner 10 ชม." v="฿22,000 · ใช้งาน"/>
        <Row k="Pro 20 ชม. (ยอดนิยม)" v="฿40,000 · ใช้งาน"/>
        <Row k="Master 30 ชม." v="฿56,000 · ใช้งาน"/>
        <div className="pagetip">อายุแพ็กเกจ: <b>6 เดือน</b> · หักชั่วโมงเมื่อเรียนจริง</div>
      </Card>

      <Card title="สล็อตสอน">
        <Row k="ความยาวสล็อต" v="60 นาที"/>
        <Row k="เวลาทำการ" v="อังคาร–อาทิตย์ 10:00–20:00 น."/>
        <Row k="แจ้งเตือนนักเรียน" v="24 ชม. + ทวงถาม 6 ชม. ก่อน"/>
        <Row k="ช่องทางแจ้งเตือน" v="ในเว็บ + LINE Push (เสริม)"/>
      </Card>

      <Card title="การแจ้งเตือน">
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>เตือนนัด 1 วัน</div>
            <div className="muted" style={{ fontSize: 11 }}>ในเว็บ + LINE (ถ้าผูกบัญชี)</div>
          </div>
          <Badge tone="green">เปิด</Badge>
        </div>
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>แจ้งเตือนแพ็กเกจใกล้หมดอายุ</div>
            <div className="muted" style={{ fontSize: 11 }}>30 / 7 / 1 วันก่อนหมดอายุ</div>
          </div>
          <Badge tone="green">เปิด</Badge>
        </div>
        <div className="toggle-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>LINE OA (ฟีเจอร์เสริม)</div>
            <div className="muted" style={{ fontSize: 11 }}>Push เตือนนัด + เมนูลัดลิงก์กลับเว็บ</div>
          </div>
          <Badge tone="amber">เชื่อมต่อแล้ว</Badge>
        </div>
      </Card>

      <Card title="ความปลอดภัย">
        <Row k="เข้ารหัสข้อมูล" v="Encryption at rest + TLS"/>
        <Row k="สิทธิ์การเข้าถึง" v="RBAC (student/teacher/admin)"/>
        <Row k="สำรองข้อมูล" v="อัตโนมัติทุกวัน"/>
        <Row k="PDPA" v="เก็บ consent + สิทธิ์ลบข้อมูล"/>
      </Card>
    </div>);
}
