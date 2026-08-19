import { Badge, Button, Card } from '@components/ui';
import { useApp } from '@app/context/AppContext';
import { avatarSrc } from '@app/utils/avatar';

export default function Profile() {
    const { t, toast, user } = useApp();
    const rows = [
        [t('profile.name'), user?.name ?? ''],
        [t('profile.nickname'), user?.nickname ?? ''],
        [t('profile.age'), `${user?.age ?? 0} ${t('profile.years')}`],
        [t('profile.education'), user?.education ?? ''],
        [t('profile.genres'), user?.genres?.join(', ') ?? ''],
        [t('profile.reason'), user?.reason ?? ''],
        [t('profile.line'), user?.lineLinked ? t('profile.lineOn') : '—'],
    ];
    return (<div className="grid cols-2">
      <Card className="profile-card">
        <div className="avatar-lg">
          <img src={avatarSrc(user)} alt={user?.nickname ?? ''}/>
        </div>
        <div className="profile-name">{user?.nickname}</div>
        <div className="muted">{user?.name}</div>
        <div className="profile-badges">
          <Badge tone="green">{t('profile.email')}: {user?.email}</Badge>
          <Badge tone="blue">{t('profile.joined')}</Badge>
        </div>
        <Button pink onClick={() => toast(t('profile.editToast'), 'ok')} style={{ marginTop: 18 }}>
          {t('profile.edit')}
        </Button>
      </Card>

      <Card title={t('profile.member')}>
        {rows.map(([k, v]) => (<div className="info-row" key={k}>
            <span className="muted">{k}</span>
            <b>{v}</b>
          </div>))}
        <div className="termbox" style={{ marginTop: 14 }}>
          {t('profile.pdpa')}
        </div>
      </Card>
    </div>);
}
