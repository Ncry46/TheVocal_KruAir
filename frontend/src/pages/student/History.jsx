import { useEffect, useMemo, useState } from 'react';
import { Button, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { daysInMonth, filterSignaturesByDate, signatureYears } from '../admin/signatureFilter.js';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isNoShow(lesson) {
    const value = String(lesson || '').toLowerCase();
    return value.includes('no-show') || value.includes('ไม่มา');
}

export default function History() {
    const { language, t } = useApp();
    const [hist, setHist] = useState(null);
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
        api.getHistory().then(setHist).catch(() => setHist([]));
    }, [language]);

    const yearOptions = useMemo(
        () => signatureYears(hist || [], Number(todayParts.year)),
        [hist, todayParts.year],
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
        for (const row of hist || []) {
            if (row.slotTime) {
                times.add(row.slotTime);
            }
        }
        return Array.from(times).sort();
    }, [hist]);

    const filtered = useMemo(() => {
        const byDate = filterSignaturesByDate(hist || [], {
            year: filterYear,
            month: filterMonth,
            day: filterDay,
        });
        if (!filterTime) {
            return byDate;
        }
        return byDate.filter((row) => row.slotTime === filterTime);
    }, [hist, filterYear, filterMonth, filterDay, filterTime]);

    const stats = useMemo(() => {
        const hours = filtered.reduce((sum, row) => sum + Number(row.usedHours || 0), 0);
        return {
            classes: filtered.length,
            hours,
        };
    }, [filtered]);

    const resetFilter = () => {
        setFilterYear('');
        setFilterMonth('');
        setFilterDay('');
        setFilterTime('');
    };

    if (!hist) {
        return <Spinner />;
    }

    return (
      <div className="history-page">
        <header className="history-topbar">
          <div className="history-topbar-main">
            <span className="history-eyebrow">{t('nav.history')}</span>
            <h2 className="history-title">{t('history.title')}</h2>
            <p className="muted history-sub">{t('pages.historySub')}</p>
          </div>
          <div className="history-topbar-meta">
            <div className="history-stat">
              <span className="label">{t('history.classesLabel')}</span>
              <strong>{stats.classes}</strong>
            </div>
            <div className="history-stat">
              <span className="label">{t('history.hoursLabel')}</span>
              <strong>{stats.hours} <span className="unit">{t('history.hoursUnit')}</span></strong>
            </div>
          </div>
        </header>

        {hist.length === 0 ? (
          <div className="history-empty">
            <h3>{t('history.emptyTitle')}</h3>
            <p className="muted">{t('history.emptyBody')}</p>
          </div>
        ) : (
          <>
            <div className="history-filter-bar">
              <label className="history-filter-field">
                <span className="muted">{t('history.filterYear')}</span>
                <select
                  className="input"
                  value={filterYear}
                  onChange={(e) => {
                      setFilterYear(e.target.value);
                      setFilterDay('');
                  }}
                >
                  <option value="">{t('history.allYears')}</option>
                  {yearOptions.map((item) => (
                    <option key={item} value={item}>{language === 'en' ? item : Number(item) + 543}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('history.filterMonth')}</span>
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
                  <option value="">{t('history.allMonths')}</option>
                  {monthLabels.map((label, index) => (
                    <option key={label} value={String(index + 1)}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('history.filterDay')}</span>
                <select
                  className="input"
                  value={filterDay}
                  disabled={!filterYear || !filterMonth}
                  onChange={(e) => setFilterDay(e.target.value)}
                >
                  <option value="">{t('history.allDays')}</option>
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label className="history-filter-field">
                <span className="muted">{t('history.filterTime')}</span>
                <select
                  className="input"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                >
                  <option value="">{t('history.allTimes')}</option>
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </label>
              <Button ghost size="sm" type="button" onClick={resetFilter}>
                {t('history.resetFilter')}
              </Button>
            </div>

            {filtered.length === 0 ? (
              <div className="history-empty">
                <h3>{t('history.noResults')}</h3>
                <p className="muted">{t('history.noResultsBody')}</p>
              </div>
            ) : (
              <ul className="history-list">
                {filtered.map((row, index) => {
                    const noShow = isNoShow(row.lesson);
                    const noteText = row.note && row.note !== '—' ? row.note : null;
                    return (
                      <li key={`${row.slotIso || row.date}-${row.slotTime || row.time}-${index}`} className={`history-card${noShow ? ' noshow' : ''}`}>
                        <div className="history-card-top">
                          <div className="history-card-meta">
                            <div className="history-card-when">
                              <span className="history-card-date">{row.date}</span>
                              <span className="history-card-dot" aria-hidden="true"/>
                              <span className="history-card-time">{row.time}</span>
                            </div>
                            <h3 className="history-card-lesson">{row.lesson}</h3>
                          </div>
                          <div className="history-card-side">
                            <span className={`badge ${noShow ? 'red' : 'green'}`}>
                              {noShow ? t('history.statusNoShow') : t('history.statusDone')}
                            </span>
                            <span className="history-hours-chip">
                              {Number(row.usedHours || 0)} {t('history.hoursUnit')}
                            </span>
                          </div>
                        </div>

                        {(noteText || row.audioUrl) && (
                          <div className="history-card-body">
                            {noteText && (
                              <div className="history-note-block">
                                <div className="history-block-label">{t('history.note')}</div>
                                <p className="history-note">{noteText}</p>
                              </div>
                            )}
                            {row.audioUrl && (
                              <div className="history-audio-block">
                                <div className="history-block-label">{t('history.audio')}</div>
                                <a href={row.audioUrl} target="_blank" rel="noreferrer" className="btn ghost sm">
                                  {t('history.openAudio')}
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    );
}
