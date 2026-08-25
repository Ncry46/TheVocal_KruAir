import { useEffect, useMemo, useState } from 'react';
import { RevenueAnalyticsChart } from '@components/admin/RevenueAnalyticsChart';
import { Card, Kpi, Spinner, Table } from '@components/ui';
import { GraduationIcon, ReceiptIcon, TicketIcon, WalletIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
export default function Sales() {
    const { language } = useApp();
    const [report, setReport] = useState(null);
    const [salesDate, setSalesDate] = useState('');
    const [salesPage, setSalesPage] = useState(1);
    useEffect(() => {
        api.getSalesReport().then(setReport);
    }, [language]);
    useEffect(() => {
        if (!salesDate && report?.sales?.[0]?.paidAt) {
            setSalesDate(report.sales[0].paidAt.slice(0, 10));
        }
    }, [report, salesDate]);
    useEffect(() => {
        setSalesPage(1);
    }, [salesDate]);
    const latestSalesTitle = language === 'en' ? 'Latest sales' : 'รายการขายล่าสุด';
    const filteredSales = useMemo(() => {
        const sales = report?.sales ?? [];
        if (!salesDate)
            return sales;
        return sales.filter((sale) => {
            if (!sale.paidAt)
                return false;
            return sale.paidAt.slice(0, 10) === salesDate;
        });
    }, [report?.sales, salesDate]);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
    const safePage = Math.min(salesPage, totalPages);
    const pagedSales = filteredSales.slice((safePage - 1) * pageSize, safePage * pageSize);
    if (!report)
        return <Spinner />;
    return (<>
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Kpi tone="pink" icon={<WalletIcon width={19} height={19}/>} value={`฿${report.revenue.toLocaleString()}`} label="รายได้เดือน ส.ค." sub="+18% vs เดือนก่อน"/>
        <Kpi tone="blue" icon={<ReceiptIcon width={19} height={19}/>} value={String(report.orders)} label="ออเดอร์เดือนนี้" sub="เฉลี่ย ฿25,333/ออเดอร์"/>
        <Kpi tone="gold" icon={<TicketIcon width={19} height={19}/>} value={String(report.vouchersUsed)} label="วอเชอร์ที่ใช้" sub="ส่วนลดรวม ฿5,000"/>
        <Kpi tone="green" icon={<GraduationIcon width={19} height={19}/>} value={String(report.newStudents)} label="นักเรียนใหม่" sub="เดือนนี้"/>
      </div>

      <div className="grid">
        <RevenueAnalyticsChart analytics={report.analytics} />

        <Card
          title={latestSalesTitle}
          action={<div className="sales-date-actions">
            <input className="input sales-date-filter" type="date" value={salesDate} onChange={(e) => setSalesDate(e.target.value)} />
            <button className="btn ghost sm" type="button" onClick={() => setSalesDate('')}>
              {language === 'en' ? 'All' : 'ทั้งหมด'}
            </button>
          </div>}
        >
          <Table heads={['วันที่', 'นักเรียน', 'แพ็กเกจ', 'วอเชอร์', 'ยอด', 'ช่องทาง']} rows={pagedSales.map((s) => [
            s.date,
            <b key="n">{s.student}</b>,
            s.pkg,
            s.voucher === '—' ? <span key="v" className="muted">—</span> : s.voucher,
            <b key="a">฿{s.amount.toLocaleString()}</b>,
            s.method,
        ])}/>
          {filteredSales.length > pageSize && (<div className="table-pagination">
              <button className="btn ghost sm" disabled={safePage === 1} onClick={() => setSalesPage((page) => Math.max(1, page - 1))}>
                {language === 'en' ? 'Previous' : 'ก่อนหน้า'}
              </button>
              <span>
                {language === 'en' ? 'Page' : 'หน้า'} {safePage} / {totalPages}
              </span>
              <button className="btn ghost sm" disabled={safePage === totalPages} onClick={() => setSalesPage((page) => Math.min(totalPages, page + 1))}>
                {language === 'en' ? 'Next' : 'ถัดไป'}
              </button>
            </div>)}
        </Card>
      </div>
    </>);
}
