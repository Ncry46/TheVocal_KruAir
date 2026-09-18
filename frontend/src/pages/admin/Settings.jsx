import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Spinner } from '@components/ui';
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
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [lineMenuBusy, setLineMenuBusy] = useState(false);

    useEffect(() => {
        const google = searchParams.get('google');
        if (google === 'connected') {
            toast(t('settings.googleConnected'), 'ok');
            searchParams.delete('google');
            setSearchParams(searchParams, { replace: true });
        }
        if (google === 'error') {
            toast(searchParams.get('msg') || t('settings.loadFailed'));
            searchParams.delete('google');
            searchParams.delete('msg');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams, t, toast]);

    useEffect(() => {
        setLoadError('');
        api.getSettings()
            .then((settings) => {
                setData(settings);
            })
            .catch((err) => {
                const message = err instanceof Error ? err.message : t('settings.loadFailed');
                setLoadError(message);
                toast(message);
            });
    }, [language, t, toast]);

    if (!data) {
        if (loadError) {
            return (
              <Card title={t('nav.settings')}>
                <div className="empty">{loadError}</div>
                <Button pink style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
                  {language === 'en' ? 'Retry' : 'ลองใหม่'}
                </Button>
              </Card>
            );
        }
        return <Spinner />;
    }

    const lastRun = data.jobs.lastRunAt
        ? new Date(data.jobs.lastRunAt).toLocaleString(language === 'en' ? 'en-GB' : 'th-TH')
        : t('settings.neverRun');
    const paymentLabel = data.integrations.payment.mode === 'transfer'
        ? t('settings.paymentTransfer')
        : data.integrations.payment.mode === 'mock'
            ? t('settings.paymentMock')
            : t('settings.paymentUnconfigured');

    return (
      <>
        <div className="grid cols-2 settings-grid">
          <Card title={t('settings.school')} action={<Badge tone="pink">{t('settings.liveOps')}</Badge>}>
            <div className="info-grid">
              <div className="info-item"><span className="muted">{t('settings.schoolName')}</span><b>{data.school.name}</b></div>
              <div className="info-item"><span className="muted">{t('settings.publicUrl')}</span><b>{data.school.publicUrl}</b></div>
              <div className="info-item"><span className="muted">{t('settings.classType')}</span><b>{data.school.studio}</b></div>
              <div className="info-item"><span className="muted">{t('settings.workingHours')}</span><b>{data.schedule.workingHours}</b></div>
              <div className="info-item"><span className="muted">{t('settings.closedDay')}</span><b>{data.school.closedDay}</b></div>
            </div>
            <div className="pagetip">{t('settings.schoolTip')}</div>
          </Card>

          <Card title={t('settings.slots')}>
            <div className="info-grid">
              <div className="info-item"><span className="muted">{t('settings.slotLength')}</span><b>{`${data.schedule.slotMinutes} ${language === 'en' ? 'minutes' : 'นาที'}`}</b></div>
              <div className="info-item"><span className="muted">{t('settings.confirmRule')}</span><b>{t('settings.confirmRuleVal').replace('{n}', String(data.schedule.confirmHours))}</b></div>
              <div className="info-item"><span className="muted">{t('settings.cancelRule')}</span><b>{t('settings.cancelRuleVal').replace('{n}', String(data.schedule.cancelHours))}</b></div>
              <div className="info-item"><span className="muted">{t('settings.times')}</span><b>{data.schedule.slotTimes.join(', ')}</b></div>
            </div>
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
                <div className="muted" style={{ fontSize: 11 }}>
                  {data.integrations.lineOa.connected ? t('settings.lineOaOn') : t('settings.lineOaOff')}
                </div>
              </div>
              <Status
                on={data.integrations.lineOa.connected}
                onLabel={t('settings.ready')}
                offLabel={t('settings.notConnected')}
              />
            </div>
            <Row k={t('settings.lineWebhook')} v={data.integrations.lineOa.webhookUrl || '—'}/>
            <Row k={t('settings.liffId')} v={data.integrations.lineOa.liffId || t('settings.notConnected')}/>
            <Button
              pink
              size="sm"
              style={{ width: '100%', marginTop: 8 }}
              disabled={lineMenuBusy || !data.integrations.lineOa.connected || !data.integrations.lineOa.liffConfigured}
              onClick={() => {
                setLineMenuBusy(true);
                api.publishLineRichMenu()
                  .then((result) => {
                    toast(t('settings.lineRichMenuOk').replace('{id}', result.menuId || ''), 'ok');
                  })
                  .catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')))
                  .finally(() => setLineMenuBusy(false));
              }}
            >
              {lineMenuBusy ? t('settings.lineRichMenuBusy') : t('settings.lineRichMenuPublish')}
            </Button>
            <div className="pagetip">{t('settings.lineRichMenuTip')}</div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.payment')}</div>
                <div className="muted" style={{ fontSize: 11 }}>{paymentLabel}</div>
              </div>
              <Badge tone={data.integrations.payment.mode === 'transfer' ? 'green' : 'amber'}>
                {data.integrations.payment.mode === 'transfer' ? t('settings.ready') : t('settings.notConnected')}
              </Badge>
            </div>
            <div className="toggle-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('settings.googleCalendar')}</div>
                <div className="muted" style={{ fontSize: 11 }}>
                  {data.integrations.googleCalendar?.configured
                    ? (data.integrations.googleCalendar?.connected ? t('settings.googleConnected') : t('settings.googleCalendarHint'))
                    : t('settings.googleNotConfigured')}
                </div>
                {data.integrations.googleCalendar?.configured && data.integrations.googleCalendar?.redirectUri && (
                  <div style={{ marginTop: 8, fontSize: 11, wordBreak: 'break-all' }}>
                    <div className="muted">{t('settings.googleRedirectHint')}</div>
                    <code style={{ display: 'block', marginTop: 4, padding: '6px 8px', borderRadius: 8, background: 'var(--bg-soft)', color: 'var(--ink)' }}>
                      {data.integrations.googleCalendar.redirectUri}
                    </code>
                  </div>
                )}
              </div>
              {data.integrations.googleCalendar?.configured ? (
                data.integrations.googleCalendar?.connected ? (
                  <Button ghost size="sm" onClick={() => api.disconnectGoogleCalendar().then(() => {
                      toast(language === 'en' ? 'Disconnected' : 'ยกเลิกการเชื่อมต่อแล้ว', 'ok');
                      api.getSettings().then(setData);
                  }).catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')))}>
                    {t('settings.googleDisconnect')}
                  </Button>
                ) : (
                  <Button pink size="sm" onClick={() => api.connectGoogleCalendar().catch((err) => toast(err instanceof Error ? err.message : t('settings.loadFailed')))}>
                    {t('settings.googleConnect')}
                  </Button>
                )
              ) : (
                <Badge tone="gray">{t('settings.notConnected')}</Badge>
              )}
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
              <Status on={data.jobs.packageExpiry?.enabled ?? false} onLabel={t('settings.on')} offLabel={t('settings.off')}/>
            </div>
            <Row k={t('settings.lastJob')} v={lastRun}/>
            <Row k={t('settings.lastExpired')} v={String(data.jobs.lastExpired ?? 0)}/>
            <Row k={t('settings.lastReminded')} v={String(data.jobs.lastReminded ?? 0)}/>
            <Row k={t('settings.lastExpiry')} v={String(data.jobs.lastExpiry ?? 0)}/>
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
