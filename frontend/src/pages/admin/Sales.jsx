import { useEffect, useMemo, useState } from 'react';
import { RevenueAnalyticsChart } from '@components/admin/RevenueAnalyticsChart';
import { Card, Kpi, Spinner, Table } from '@components/ui';
import { GraduationIcon, ReceiptIcon, TicketIcon, WalletIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { filterSalesByPeriod, paginateSales, SALES_PAGE_SIZE } from './salesTable';

export default function Sales() {
    const { language } = useApp();
    const [report, setReport] = useState(null);
    const [salesPeriod, setSalesPeriod] = useState('monthly');
    const [salesPage, setSalesPage] = useState(1);
    useEffect(() => {
        api.getSalesReport().then(setReport);
    }, [language]);
    useEffect(() => {
        setSalesPage(1);
    }, [salesPeriod]);
    const latestSalesTitle = language === 'en' ? 'Latest sales' : 'รายการขายล่าสุด';
    const salesPeriodOptions = [
        { value: 'daily', label: language === 'en' ? 'Daily' : 'รายวัน' },
        { value: 'monthly', label: language === 'en' ? 'Monthly' : 'รายเดือน' },
        { value: 'yearly', label: language === 'en' ? 'Yearly' : 'รายปี' },
    ];
    const filteredSales = useMemo(
        () => filterSalesByPeriod(report?.sales ?? [], salesPeriod),
        [report?.sales, salesPeriod],
    );
    const { totalPages, safePage, rows: pagedSales, showPagination } = paginateSales(filteredSales, salesPage, SALES_PAGE_SIZE);
    const emptyMessage = language === 'en' ? 'No sales in this period' : 'ไม่มีรายการขายในช่วงนี้';
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
          action={<select className="input sales-filter" value={salesPeriod} onChange={(e) => setSalesPeriod(e.target.value)} aria-label={latestSalesTitle}>
            {salesPeriodOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
          </select>}
        >
          {pagedSales.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>{emptyMessage}</p>
          ) : (
            <Table heads={['วันที่', 'นักเรียน', 'แพ็กเกจ', 'วอเชอร์', 'ยอด', 'ช่องทาง']} rows={pagedSales.map((s) => [
              s.date,
              <b key={`${s.paidAt}-${s.student}`}>{s.student}</b>,
              s.pkg,
              s.voucher === '—' ? <span key="v" className="muted">—</span> : s.voucher,
              <b key="a">฿{s.amount.toLocaleString()}</b>,
              s.method,
            ])}/>
          )}
          {showPagination && (<div className="table-pagination">
              <button className="btn ghost sm" type="button" disabled={safePage === 1} onClick={() => setSalesPage((page) => Math.max(1, page - 1))}>
                {language === 'en' ? 'Previous' : 'ก่อนหน้า'}
              </button>
              <span>
                {language === 'en' ? 'Page' : 'หน้า'} {safePage} / {totalPages}
              </span>
              <button className="btn ghost sm" type="button" disabled={safePage === totalPages} onClick={() => setSalesPage((page) => Math.min(totalPages, page + 1))}>
                {language === 'en' ? 'Next' : 'ถัดไป'}
              </button>
            </div>)}
        </Card>
      </div>
    </>);
}
