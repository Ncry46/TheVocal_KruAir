import { useEffect, useState } from 'react';
import { Badge, Card, Kpi, Spinner, Table } from '@components/ui';
import { GraduationIcon, ReceiptIcon, TicketIcon, WalletIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
export default function Sales() {
    const { language } = useApp();
    const [report, setReport] = useState(null);
    useEffect(() => {
        api.getSalesReport().then(setReport);
    }, [language]);
    if (!report)
        return <Spinner />;
    const max = Math.max(...report.monthly.map((m) => m.value));
    const latestSalesTitle = language === 'en' ? 'Latest sales' : 'รายการขายล่าสุด';
    return (<>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Kpi tone="pink" icon={<WalletIcon width={19} height={19}/>} value={`฿${report.revenue.toLocaleString()}`} label="รายได้เดือน ส.ค." sub="+18% vs เดือนก่อน"/>
        <Kpi tone="blue" icon={<ReceiptIcon width={19} height={19}/>} value={String(report.orders)} label="ออเดอร์เดือนนี้" sub="เฉลี่ย ฿25,333/ออเดอร์"/>
        <Kpi tone="gold" icon={<TicketIcon width={19} height={19}/>} value={String(report.vouchersUsed)} label="วอเชอร์ที่ใช้" sub="ส่วนลดรวม ฿5,000"/>
        <Kpi tone="green" icon={<GraduationIcon width={19} height={19}/>} value={String(report.newStudents)} label="นักเรียนใหม่" sub="เดือนนี้"/>
      </div>

      <div className="grid cols-2">
        <Card title={latestSalesTitle} action={<Badge tone="green">12 เดือน</Badge>}>
          <div className="bar-chart">
            {report.monthly.map((m) => (<div className="bar" key={m.label}>
                <b>{m.value}k</b>
                <i style={{ height: `${Math.round((m.value / max) * 100)}%` }}/>
                <span>{m.label}</span>
              </div>))}
          </div>
        </Card>

        <Card title={latestSalesTitle}>
          <Table heads={['วันที่', 'นักเรียน', 'แพ็กเกจ', 'วอเชอร์', 'ยอด', 'ช่องทาง']} rows={report.sales.map((s) => [
            s.date,
            <b key="n">{s.student}</b>,
            s.pkg,
            s.voucher === '—' ? <span key="v" className="muted">—</span> : s.voucher,
            <b key="a">฿{s.amount.toLocaleString()}</b>,
            s.method,
        ])}/>
        </Card>
      </div>
    </>);
}
