import { useEffect, useState } from 'react';
import { Badge, Card, Spinner } from '@components/ui';
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

export default function Settings() {
    const { language, t, toast } = useApp();
    const [data, setData] = useState(null);

    useEffect(() => {
        api.getSettings()
            .then(setData)
            .catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')));
    }, [language]);

    if (!data) {
        return <Spinner />;
    }

    const lastRun = data.reminders.lastRunAt
        ? new Date(data.reminders.lastRunAt).toLocaleString(language === 'en' ? 'en-GB' : 'th-TH')
        : t('settings.neverRun');

    return (
      <div className="grid cols-2">
        <Card title={t('settings.packages')}>
          {data.packages.map((pkg) => (
            <Row
              key={pkg.id}
              k={`${pkg.name} ${pkg.hours} ${language === 'en' ? 'hrs' : 'ชม.'}`}
              v={`฿${Number(pkg.price).toLocaleString()} · ${pkg.active ? t('settings.active') : t('settings.inactive')}`}
            />
          ))}
          <div className="pagetip">{t('settings.packageTip')}</div>
        </Card>

        <Card title={t('settings.slots')}>
          <Row k={t('settings.slotLength')} v={t('settings.slotLengthVal')}/>
          <Row k={t('settings.workingHours')} v={data.workingHours}/>
          <Row k={t('settings.times')} v={data.slotTimes.join(', ')}/>
          <div className="pagetip">{t('settings.slotTip')}</div>
        </Card>

        <Card title={t('settings.alerts')}>
          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.dayBefore')}</div>
              <div className="muted" style={{ fontSize: 11 }}>{data.reminders.dayBefore.channel}</div>
            </div>
            <Badge tone={data.reminders.dayBefore.enabled ? 'green' : 'gray'}>
              {data.reminders.dayBefore.enabled ? t('settings.on') : t('settings.off')}
            </Badge>
          </div>
          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.expiry')}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t('settings.expiryHint')}</div>
            </div>
            <Badge tone="gray">{t('settings.off')}</Badge>
          </div>
          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineLogin')}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {data.lineLogin?.configured ? t('settings.lineLoginOn') : t('settings.lineLoginOff')}
              </div>
            </div>
            <Badge tone={data.lineLogin?.configured ? 'green' : 'gray'}>
              {data.lineLogin?.configured ? t('settings.on') : t('settings.notConnected')}
            </Badge>
          </div>
          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.lineOa')}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t('settings.lineHint')}</div>
            </div>
            <Badge tone="gray">{t('settings.notConnected')}</Badge>
          </div>
          <div className="pagetip">{t('settings.lastJob')}: {lastRun}</div>
        </Card>

        <Card title={t('settings.security')}>
          <Row k={t('settings.tls')} v={t('settings.tlsVal')}/>
          <Row k={t('settings.rbac')} v={t('settings.rbacVal')}/>
          <Row k={t('settings.backup')} v={t('settings.backupVal')}/>
          <Row k={t('settings.pdpa')} v={t('settings.pdpaVal')}/>
        </Card>
      </div>
    );
}
