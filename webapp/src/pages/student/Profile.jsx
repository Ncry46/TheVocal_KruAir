import { Badge, Button, Card } from '../../components/ui';
import { useApp } from '../../context/AppContext';
export default function Profile() {
    const { user, toast } = useApp();
    const rows = [
        ['ชื่อจริง', user?.name ?? ''],
        ['ชื่อเล่น', user?.nickname ?? ''],
        ['อายุ', `${user?.age ?? 0} ปี`],
        ['ระดับการศึกษา', user?.education ?? ''],
        ['แนวเพลงที่ชอบ', user?.genres.join(', ') ?? ''],
        ['เหตุผลที่อยากเรียน', user?.reason ?? ''],
        ['เชื่อมต่อ LINE', user?.lineLinked ? 'ผูกแล้ว (ฟีเจอร์เสริม)' : '—'],
    ];
    return (<div className="grid cols-2">
      <Card className="profile-card">
        <div className="avatar-lg">
          <img src="/img/av-1.jpg" alt="รูปโปรไฟล์"/>
        </div>
        <div className="profile-name">น้อง{user?.nickname}</div>
        <div className="muted">{user?.name}</div>
        <div className="profile-badges">
          <Badge tone="green">อีเมล: {user?.email}</Badge>
          <Badge tone="blue">สมัคร ก.ค. 2026</Badge>
        </div>
        <Button pink onClick={() => toast('เปิดฟอร์มแก้ไขข้อมูล', 'ok')} style={{ marginTop: 18 }}>
          แก้ไขข้อมูล
        </Button>
      </Card>

      <Card title="ข้อมูลสมาชิก">
        {rows.map(([k, v]) => (<div className="info-row" key={k}>
            <span className="muted">{k}</span>
            <b>{v}</b>
          </div>))}
        <div className="termbox" style={{ marginTop: 14 }}>
          ข้อมูลส่วนบุคคลเข้ารหัสและคุ้มครองตาม <b>PDPA</b> — ขอสิทธิ์แก้ไข/ลบข้อมูลได้ที่ครูแอร์
        </div>
      </Card>
    </div>);
}
