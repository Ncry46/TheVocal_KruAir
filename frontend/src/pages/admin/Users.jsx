import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Input, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { avatarSrc } from '@app/utils/avatar';

const FILTERS = ['all', 'student', 'teacher'];

export default function Users() {
    const { language, t, toast, user: me } = useApp();
    const [rows, setRows] = useState(null);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');

    const load = () => api.getUsers().then(setRows);

    useEffect(() => {
        load();
    }, [language]);

    const filtered = useMemo(() => {
        const list = rows ?? [];
        const needle = q.trim().toLowerCase();
        return list.filter((row) => {
            const roleKey = row.role === 'admin' ? 'teacher' : row.role;
            if (filter !== 'all' && roleKey !== filter) {
                return false;
            }
            if (!needle) {
                return true;
            }
            return [row.name, row.nickname, row.email, row.phone].some((value) => String(value ?? '').toLowerCase().includes(needle));
        });
    }, [rows, q, filter]);

    const roleLabel = (role) => {
        if (role === 'teacher' || role === 'admin') {
            return t('roles.teacher');
        }
        return t('roles.student');
    };

    const roleTone = (role) => {
        if (role === 'teacher' || role === 'admin') {
            return 'pink';
        }
        return 'green';
    };

    const toggleStatus = async (row) => {
        const next = row.status === 'Y' ? 'N' : 'Y';
        try {
            await api.setUserStatus(row.id, next);
            setRows((prev) => prev?.map((item) => (item.id === row.id ? { ...item, status: next } : item)) ?? null);
            toast(next === 'Y' ? t('users.enabledOk') : t('users.disabledOk'), 'ok');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('users.updateFailed'));
        }
    };

    if (!rows) {
        return <Spinner />;
    }

    return (
      <Card
        title={t('users.title')}
        action={(
          <div className="users-toolbar">
            <Input placeholder={t('users.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }}/>
          </div>
        )}
      >
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {FILTERS.map((key) => (
            <button key={key} type="button" className={`dchip ${filter === key ? 'on' : ''}`} onClick={() => setFilter(key)}>
              {t(`users.filter.${key}`)}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div className="empty">{t('users.empty')}</div>
        ) : (
          <Table
            heads={[t('users.userNo'), t('users.person'), t('users.email'), t('users.role'), t('users.package'), t('users.created'), t('users.status'), '']}
            rows={filtered.map((row) => [
              <b key="id">{row.id}</b>,
              <div key="p" className="user-cell">
                <div className="ava">
                  <img src={avatarSrc(row)} alt=""/>
                </div>
                <div>
                  <b>{row.nickname}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{row.name}</div>
                </div>
              </div>,
              row.email,
              <Badge key="r" tone={roleTone(row.role)}>{roleLabel(row.role)}</Badge>,
              row.role === 'student' ? row.pkg : '—',
              row.createdAt,
              row.status === 'Y'
                  ? <Badge key="s" tone="green">{t('users.active')}</Badge>
                  : <Badge key="s" tone="gray">{t('users.disabled')}</Badge>,
              row.id === me?.id ? (
                  <span key="a" className="muted">{t('users.you')}</span>
              ) : (
                  <Button key="a" size="sm" danger={row.status === 'Y'} ghost={row.status !== 'Y'} onClick={() => toggleStatus(row)}>
                    {row.status === 'Y' ? t('users.disable') : t('users.enable')}
                  </Button>
              ),
            ])}
          />
        )}
      </Card>
    );
}
