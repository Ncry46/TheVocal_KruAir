import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
import { avatarSrc } from '@app/utils/avatar';

const FILTERS = ['all', 'student', 'teacher', 'admin'];
const EMPTY_FORM = { name: '', nickname: '', email: '', password: '', phone: '' };

export default function Users() {
    const { language, t, toast, user: me } = useApp();
    const [rows, setRows] = useState(null);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('all');
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);

    const load = () => api.getUsers().then(setRows);

    useEffect(() => {
        load();
    }, [language]);

    const filtered = useMemo(() => {
        const list = rows ?? [];
        const needle = q.trim().toLowerCase();
        return list.filter((row) => {
            if (filter !== 'all' && row.role !== filter) {
                return false;
            }
            if (!needle) {
                return true;
            }
            return [row.name, row.nickname, row.email, row.phone].some((value) => String(value ?? '').toLowerCase().includes(needle));
        });
    }, [rows, q, filter]);

    const roleLabel = (role) => {
        if (role === 'teacher') {
            return t('roles.teacher');
        }
        if (role === 'admin') {
            return t('roles.admin');
        }
        return t('roles.student');
    };

    const roleTone = (role) => {
        if (role === 'teacher') {
            return 'pink';
        }
        if (role === 'admin') {
            return 'blue';
        }
        return 'green';
    };

    const createTeacher = async () => {
        if (!form.name.trim() || !form.nickname.trim() || !form.email.trim() || form.password.length < 6) {
            return;
        }
        setBusy(true);
        try {
            await api.createUser({
                role: 'teacher',
                name: form.name.trim(),
                nickname: form.nickname.trim(),
                email: form.email.trim(),
                password: form.password,
                phone: form.phone.trim(),
            });
            setOpen(false);
            setForm(EMPTY_FORM);
            toast(t('users.createdOk'), 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('users.createFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const toggleStatus = async (row) => {
        const next = row.status === 'active' ? 'disabled' : 'active';
        try {
            await api.setUserStatus(row.id, next);
            setRows((prev) => prev?.map((item) => (item.id === row.id ? { ...item, status: next } : item)) ?? null);
            toast(next === 'active' ? t('users.enabledOk') : t('users.disabledOk'), 'ok');
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('users.updateFailed'));
        }
    };

    if (!rows) {
        return <Spinner />;
    }

    return (
      <>
        <Card
          title={t('users.title')}
          action={(
            <div className="users-toolbar">
              <Input placeholder={t('users.search')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }}/>
              <Button pink size="sm" onClick={() => setOpen(true)}>{t('users.addTeacher')}</Button>
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
              heads={[t('users.person'), t('users.email'), t('users.role'), t('users.package'), t('users.created'), t('users.status'), '']}
              rows={filtered.map((row) => [
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
                row.status === 'active'
                    ? <Badge key="s" tone="green">{t('users.active')}</Badge>
                    : <Badge key="s" tone="gray">{t('users.disabled')}</Badge>,
                row.id === me?.id ? (
                    <span key="a" className="muted">{t('users.you')}</span>
                ) : (
                    <Button key="a" size="sm" danger={row.status === 'active'} ghost={row.status !== 'active'} onClick={() => toggleStatus(row)}>
                      {row.status === 'active' ? t('users.disable') : t('users.enable')}
                    </Button>
                ),
              ])}
            />
          )}
        </Card>

        <Modal open={open} onClose={() => setOpen(false)} title={t('users.addTeacher')}>
          <Field label={t('users.name')} required>
            <Input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}/>
          </Field>
          <Field label={t('users.nickname')} required>
            <Input value={form.nickname} onChange={(e) => setForm((current) => ({ ...current, nickname: e.target.value }))}/>
          </Field>
          <Field label={t('users.email')} required>
            <Input type="email" placeholder="teacher@email.com" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}/>
          </Field>
          <Field label={t('users.password')} required>
            <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}/>
          </Field>
          <Field label={t('users.phone')}>
            <Input value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}/>
          </Field>
          <Button pink style={{ width: '100%' }} onClick={createTeacher} disabled={busy}>
            {busy ? t('users.creating') : t('users.create')}
          </Button>
        </Modal>
      </>
    );
}
