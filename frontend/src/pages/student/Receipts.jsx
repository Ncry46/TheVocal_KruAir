import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Modal, Spinner } from '@components/ui';
import { BrandLogo } from '@components/BrandLogo';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { daysInMonth, filterSignaturesByDate, signatureYears } from '../admin/signatureFilter.js';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function receiptStatusTone(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('สำเร็จ') || value === 'paid' || value.includes('success')) {
        return 'green';
    }
    if (value.includes('รอครู') || value.includes('awaiting')) {
        return 'blue';
    }
    if (value.includes('รอ') || value.includes('pending')) {
        return 'amber';
    }
    if (value.includes('ไม่สำเร็จ') || value.includes('failed') || value.includes('ยกเลิก') || value.includes('cancel')) {
        return 'red';
    }
    if (value.includes('คืน') || value.includes('refund') || value.includes('หมดอายุ') || value.includes('expired')) {
        return 'gray';
    }
    return 'green';
}

function isPaidStatus(status) {
    return receiptStatusTone(status) === 'green'
        && !String(status || '').toLowerCase().includes('refund');
}

export default function Receipts() {
    const { language, t, toast } = useApp();
    const [receipts, setReceipts] = useState(null);
    const [selected, setSelected] = useState(null);
    const todayParts = useMemo(() => {
        const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
        const [year, month, day] = iso.split('-');
        return { year, month: String(Number(month)), day: String(Number(day)) };
    }, []);
    const [filterYear, setFilterYear] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterDay, setFilterDay] = useState('');
    const [filterTime, setFilterTime] = useState('');

    useEffect(() => {
        api.getReceipts().then(setReceipts).catch(() => setReceipts([]));
    }, [language]);

    const yearOptions = useMemo(
        () => signatureYears(receipts || [], Number(todayParts.year)),
        [receipts, todayParts.year],
    );
    const monthLabels = language === 'en' ? EN_MONTHS : TH_MONTHS;
    const dayOptions = useMemo(() => {
        if (!filterYear || !filterMonth) {
            return [];
        }
        return Array.from({ length: daysInMonth(filterYear, filterMonth) }, (_, index) => String(index + 1));
    }, [filterYear, filterMonth]);
    const timeOptions = useMemo(() => {
        const times = new Set();
        for (const row of receipts || []) {
            if (row.slotTime) {
                times.add(row.slotTime);
            }
        }
        return Array.from(times).sort();
    }, [receipts]);

    const filtered = useMemo(() => {
        const byDate = filterSignaturesByDate(receipts || [], {
            year: filterYear,
            month: filterMonth,
            day: filterDay,
        });
        if (!filterTime) {
            return byDate;
        }
        return byDate.filter((row) => row.slotTime === filterTime);
    }, [receipts, filterYear, filterMonth, filterDay, filterTime]);

    const paidTotal = useMemo(() => {
        if (!filtered.length) {
            return 0;
        }
        return filtered
            .filter((row) => isPaidStatus(row.status))
            .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    }, [filtered]);

    const resetFilter = () => {
        setFilterYear('');
        setFilterMonth('');
        setFilterDay('');
        setFilterTime('');
    };

    if (!receipts) {
        return <Spinner />;
    }

    return (
      <div className="receipts-page">
        <header className="receipts-topbar">
          <div className="receipts-topbar-main">
            <span className="receipts-eyebrow">{t('nav.receipts')}</span>
            <h2 className="receipts-title">{t('receipts.title')}</h2>
            <p className="muted receipts-sub">{t('pages.receiptsSub')}</p>
          </div>
          <div className="receipts-topbar-meta">
            <div className="receipts-stat">
              <span className="label">{t('receipts.countLabel')}</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="receipts-stat">
              <span className="label">{t('receipts.paidTotal')}</span>
              <strong>฿{paidTotal.toLocaleString()}</strong>
            </div>
          </div>
        </header>

        {receipts.length === 0 ? (
          <div className="receipts-empty">
            <h3>{t('receipts.emptyTitle')}</h3>
            <p className="muted">{t('receipts.emptyBody')}</p>
            <Link className="btn green" to="/app/packages">{t('receipts.goPackages')}</Link>
          </div>
        ) : (
          <>
            <div className="history-filter-bar">
              <label className="history-filter-field">
                <span className="muted">{t('receipts.filterYear')}</span>
                <select
                  className="input"
                  value={filterYear}
                  onChange={(e) => {
                      setFilterYear(e.target.value);
                      setFilterDay('');
                  }}
                >
                  <option value="">{t('receipts.allYears')}</option>
                  {yearOptions.map((item) => (
                    <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('receipts.filterMonth')}</span>
                <select
                  className="input"
                  value={filterMonth}
                  disabled={!filterYear}
                  onChange={(e) => {
                      const nextMonth = e.target.value;
                      setFilterMonth(nextMonth);
                      if (!nextMonth) {
                          setFilterDay('');
                      }
                  }}
                >
                  <option value="">{t('receipts.allMonths')}</option>
                  {monthLabels.map((label, index) => (
                    <option key={label} value={String(index + 1)}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('receipts.filterDay')}</span>
                <select
                  className="input"
                  value={filterDay}
                  disabled={!filterYear || !filterMonth}
                  onChange={(e) => setFilterDay(e.target.value)}
                >
                  <option value="">{t('receipts.allDays')}</option>
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('receipts.filterTime')}</span>
                <select
                  className="input"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                >
                  <option value="">{t('receipts.allTimes')}</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </label>
              <Button ghost size="sm" type="button" onClick={resetFilter}>
                {t('receipts.resetFilter')}
              </Button>
            </div>

            {filtered.length === 0 ? (
              <div className="receipts-empty">
                <h3>{t('receipts.noResults')}</h3>
                <p className="muted">{t('receipts.noResultsBody')}</p>
              </div>
            ) : (
              <ul className="receipts-list">
                {filtered.map((row) => (
                  <li key={row.id} className="receipt-row">
                    <div className="receipt-row-main">
                      <div className="receipt-row-date">
                        {row.date}
                        {row.slotTime ? <span className="receipt-row-time muted"> · {row.slotTime}</span> : null}
                      </div>
                      <div className="receipt-row-pkg">{row.pkg}</div>
                      <div className="receipt-row-method muted">{row.method}</div>
                    </div>
                    <div className="receipt-row-side">
                      <div className="receipt-row-amount">฿{Number(row.amount).toLocaleString()}</div>
                      <Badge tone={receiptStatusTone(row.status)}>{row.status}</Badge>
                      <Button ghost size="sm" onClick={() => setSelected(row)}>
                        {t('receipts.view')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <Modal open={selected !== null} onClose={() => setSelected(null)} title={t('receipts.modalTitle')}>
          {selected && (
            <div className="receipt-sheet">
              <div className="receipt-sheet-brand">
                <BrandLogo stacked size={64} style={{ margin: '0 auto 10px' }}/>
                <div className="muted receipt-sheet-ref">
                  {t('receipts.electronic')} · {t('receipts.ref')} {selected.id}
                </div>
              </div>
              <div className="receipt-body">
                {[
                  [t('receipts.date'), selected.slotTime ? `${selected.date} · ${selected.slotTime}` : selected.date],
                  [t('receipts.package'), selected.pkg],
                  [t('receipts.voucher'), selected.voucher],
                  [t('receipts.method'), selected.method],
                  selected.paymentRef ? [t('receipts.paymentRef'), selected.paymentRef] : null,
                  [t('receipts.status'), selected.status],
                ].filter(Boolean).map(([label, value]) => (
                  <div className="sumrow" key={label}>
                    <span className="muted">{label}</span>
                    <b>{value}</b>
                  </div>
                ))}
                <div className="sumrow total">
                  <span>{t('receipts.amount')}</span>
                  <span className="accent">฿{Number(selected.amount).toLocaleString()}</span>
                </div>
              </div>
              <Button
                pink
                style={{ width: '100%' }}
                onClick={() => toast(t('receipts.pdfToast'), 'ok')}
              >
                {t('receipts.downloadPdf')}
              </Button>
            </div>
          )}
        </Modal>
      </div>
    );
}
