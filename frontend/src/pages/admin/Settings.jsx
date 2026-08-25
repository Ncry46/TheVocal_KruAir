import { useEffect, useState } from 'react';
import { Badge, Card, Kpi, Spinner } from '@components/ui';
import { BellIcon, CalendarIcon, GraduationIcon, MicIcon } from '@components/icons';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

function Row({ k, v }) {
    return (
      <div className="info-row">
        <span className="muted">{k}</span>
        <b>{v}</b>
      </div>
    );
}

function Status({ on, onLabel, offLabel }) {
    return (
      <Badge tone={on ? 'green' : 'gray'}>
        {on ? onLabel : offLabel}
      </Badge>
    );
}

export default function Settings() {
    const { language, t, toast } = useApp();
    const [data, setData] = useState(null);

    useEffect(() => {
        api.getSettings()
            .then(setData)
            .catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')));
    }, [language, t, toast]);

    if (!data) {
        return <Spinner />;
    }

    const lastRun = data.jobs.lastRunAt
        ? new Date(data.jobs.lastRunAt).toLocaleString(language === 'en' ? 'en-GB' : 'th-TH')
        : t('settings.neverRun');
    const hoursUnit = language === 'en' ? 'hrs' : 'ชม.';
    const paymentLabel = data.integrations.payment.mode === 'mock'
        ? t('settings.paymentMock')
        : t('settings.paymentLive');

    return (
      <>
        <div className="grid cols-4" style={{ marginBottom: 18 }}>
          <Kpi
            tone="green"
            icon={<GraduationIcon width={19} height={19}/>}
            value={String(data.accounts.student)}
            label={t('settings.kpiStudents')}
            sub={t('settings.kpiActive')}
          />
          <Kpi
            tone="pink"
            icon={<MicIcon width={19} height={19}/>}
            value={String(data.accounts.teacher)}
            label={t('settings.kpiTeachers')}
            sub={t('settings.kpiActive')}
          />
          <Kpi
            tone="blue"
            icon={<CalendarIcon width={19} height={19}/>}
            value={String(data.accounts.upcomingLessons)}
            label={t('settings.kpiUpcoming')}
            sub={t('settings.kpiBooked')}
          />
          <Kpi
            tone="gold"
            icon={<BellIcon width={19} height={19}/>}
            value={String(data.jobs.lastReminded ?? 0)}
            label={t('settings.kpiReminded')}
            sub={lastRun}
          />
        </div>

        <div className="grid cols-2">
          <Card title={t('settings.school')} action={<Badge tone="pink">{t('settings.liveOps')}</Badge>}>
            <Row k={t('settings.schoolName')} v={data.school.name}/>
            <Row k={t('settings.publicUrl')} v={data.school.publicUrl}/>
            <Row k={t('settings.classType')} v={data.school.studio}/>
            <Row k={t('settings.workingHours')} v={data.schedule.workingHours}/>
            <Row k={t('settings.closedDay')} v={data.school.closedDay}/>
            <div className="pagetip">{t('settings.schoolTip')}</div>
          </Card>

          <Card title={t('settings.packages')}>
            {data.packages.map((pkg) => (
              <Row
                key={pkg.id}
                k={`${pkg.name} · ${pkg.hours} ${hoursUnit}`}
                v={`฿${Number(pkg.price).toLocaleString()} · ${pkg.active ? t('settings.active') : t('settings.inactive')}`}
              />
            ))}
            <div className="pagetip">{t('settings.packageTip')}</div>
          </Card>

          <Card title={t('settings.slots')}>
            <Row k={t('settings.slotLength')} v={`${data.schedule.slotMinutes} ${language === 'en' ? 'minutes' : 'นาที'}`}/>
            <Row k={t('settings.times')} v={data.schedule.slotTimes.join(', ')}/>
            <Row k={t('settings.confirmRule')} v={t('settings.confirmRuleVal').replace('{n}', String(data.schedule.confirmHours))}/>
            <Row k={t('settings.cancelRule')} v={t('settings.cancelRuleVal').replace('{n}', String(data.schedule.cancelHours))}/>
            <div className="pagetip">{t('settings.slotTip')}</div>
          </Card>

          <Card title={t('settings.integrations')}>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineLogin')}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {data.integrations.lineLogin.configured ? t('settings.lineLoginOn') : t('settings.lineLoginOff')}
                </div>
              </div>
              <Status
                on={data.integrations.lineLogin.configured}
                onLabel={t('settings.ready')}
                offLabel={t('settings.notConnected')}
              />
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineOa')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.lineHint')}</div>
              </div>
              <Status on={false} onLabel={t('settings.ready')} offLabel={t('settings.notConnected')}/>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.payment')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{paymentLabel}</div>
              </div>
              <Badge tone="amber">{t('settings.sandbox')}</Badge>
            </div>
            <div className="pagetip">{t('settings.integrationTip')}</div>
          </Card>

          <Card title={t('settings.jobs')}>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.dayBefore')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.dayBeforeHint')}</div>
              </div>
              <Status on={data.jobs.dayBefore.enabled} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.expirePending')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.expirePendingHint')}</div>
              </div>
              <Status on={data.jobs.expireUnconfirmed.enabled} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.expiry')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{t('settings.expiryHint')}</div>
              </div>
              <Status on={false} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <Row k={t('settings.lastJob')} v={lastRun}/>
            <Row k={t('settings.lastExpired')} v={String(data.jobs.lastExpired ?? 0)}/>
            <Row k={t('settings.lastReminded')} v={String(data.jobs.lastReminded ?? 0)}/>
          </Card>

          <Card title={t('settings.security')}>
            <Row k={t('settings.database')} v={data.data.database}/>
            <Row k={t('settings.sqlHost')} v={data.data.sqlHost || '—'}/>
            <Row
              k={t('settings.tls')}
              v={data.data.https ? t('settings.tlsOn') : t('settings.tlsOff')}
            />
            <Row k={t('settings.rbac')} v={t('settings.rbacVal')}/>
            <Row k={t('settings.backup')} v={t('settings.backupVal')}/>
            <Row k={t('settings.pdpa')} v={t('settings.pdpaVal')}/>
          </Card>
        </div>
      </>
    );
}
