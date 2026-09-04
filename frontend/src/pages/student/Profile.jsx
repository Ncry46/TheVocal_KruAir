import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Field, Input } from '@components/ui';
import { useApp } from '@app/context/AppContext';
import { avatarSrc, PRESET_AVATARS } from '@app/utils/avatar';
import { api } from '@app/services/apiClient';
import { beginLineLogin } from '@app/services/lineAuth';

const EDUCATION_OPTIONS = [
    { value: 'ม.ต้น', th: 'ม.ต้น', en: 'Lower secondary' },
    { value: 'ม.ปลาย', th: 'ม.ปลาย', en: 'Upper secondary' },
    { value: 'ปวช. / ปวส.', th: 'ปวช. / ปวส.', en: 'Vocational certificate' },
    { value: 'ปริญญาตรี', th: 'ปริญญาตรี', en: "Bachelor's degree" },
    { value: 'ปริญญาโทขึ้นไป', th: 'ปริญญาโทขึ้นไป', en: "Master's or higher" },
];
const GENRES = [
    { value: 'Pop', th: 'Pop', en: 'Pop' },
    { value: 'Ballad', th: 'Ballad', en: 'Ballad' },
    { value: 'Rock', th: 'Rock', en: 'Rock' },
    { value: 'R&B', th: 'R&B', en: 'R&B' },
    { value: 'Hip-Hop', th: 'Hip-Hop', en: 'Hip-Hop' },
    { value: 'ลูกทุ่ง', th: 'ลูกทุ่ง', en: 'Luk thung' },
    { value: 'Jazz', th: 'Jazz', en: 'Jazz' },
    { value: 'อื่น ๆ', th: 'อื่น ๆ', en: 'Other' },
];

export default function Profile() {
    const { t, toast, user, language, updateProfile, updateAvatar } = useApp();
    const [searchParams, setSearchParams] = useSearchParams();
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [avatarBusy, setAvatarBusy] = useState(false);
    const [pickingAvatar, setPickingAvatar] = useState(false);
    const [name, setName] = useState(user?.nameTh ?? user?.name ?? '');
    const [nameEn, setNameEn] = useState(user?.nameEn ?? '');
    const [nickname, setNickname] = useState(user?.nicknameTh ?? user?.nickname ?? '');
    const [nicknameEn, setNicknameEn] = useState(user?.nicknameEn ?? '');
    const [age, setAge] = useState(user?.age ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [emergencyContact, setEmergencyContact] = useState(user?.emergencyContact ?? '');
    const [education, setEducation] = useState(user?.education ?? '');
    const [genres, setGenres] = useState(user?.genres ?? []);
    const [reason, setReason] = useState(user?.reason ?? '');
    const [lineBusy, setLineBusy] = useState(false);
    const [googleBusy, setGoogleBusy] = useState(false);
    const [googleStatus, setGoogleStatus] = useState(null);
    const [oaQrUrl, setOaQrUrl] = useState(null);
    const [oaAddFriendUrl, setOaAddFriendUrl] = useState(null);

    const roleLabel = user?.role === 'teacher' || user?.role === 'admin'
        ? t('roles.teacherBadge')
        : t('roles.student');

    useEffect(() => {
        api.getLineStatus()
            .then((status) => {
                setOaQrUrl(status.oaQrUrl || null);
                setOaAddFriendUrl(status.oaAddFriendUrl || null);
            })
            .catch(() => {});
        api.getStudentGoogleCalendarStatus()
            .then(setGoogleStatus)
            .catch(() => setGoogleStatus(null));
    }, []);

    useEffect(() => {
        if (searchParams.get('line') !== 'linked') {
            return;
        }
        toast(t('profile.lineLinkedToast'), 'ok');
        const next = new URLSearchParams(searchParams);
        next.delete('line');
        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams, t, toast]);

    useEffect(() => {
        const google = searchParams.get('google');
        if (google === 'connected') {
            toast(t('profile.googleConnectedToast'), 'ok');
            api.getStudentGoogleCalendarStatus().then(setGoogleStatus).catch(() => {});
            const next = new URLSearchParams(searchParams);
            next.delete('google');
            setSearchParams(next, { replace: true });
            return;
        }
        if (google === 'error') {
            toast(searchParams.get('msg') || t('profile.googleNotConfigured'));
            const next = new URLSearchParams(searchParams);
            next.delete('google');
            next.delete('msg');
            setSearchParams(next, { replace: true });
        }
    }, [searchParams, setSearchParams, t, toast]);

    const startEdit = () => {
        const educationValue = EDUCATION_OPTIONS.find((item) => (
            item.value === user?.education || item.en === user?.education || item.th === user?.education
        ))?.value ?? user?.education ?? '';
        setName(user?.nameTh ?? user?.name ?? '');
        setNameEn(user?.nameEn ?? '');
        setNickname(user?.nicknameTh ?? user?.nickname ?? '');
        setNicknameEn(user?.nicknameEn ?? '');
        setAge(user?.age ?? '');
        setPhone(user?.phone ?? '');
        setEmergencyContact(user?.emergencyContact ?? '');
        setEducation(educationValue);
        setGenres((user?.genres ?? []).map((genre) => (
            GENRES.find((item) => item.value === genre || item.en === genre || item.th === genre)?.value ?? genre
        )));
        setReason(user?.reason ?? '');
        setEditing(true);
        setPickingAvatar(false);
    };

    const toggleGenre = (value) => {
        setGenres((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
    };

    const save = async (event) => {
        event.preventDefault();
        setBusy(true);
        try {
            await updateProfile({
                name,
                nameEn,
                nickname,
                nicknameEn,
                age: age === '' ? null : Number(age),
                phone,
                emergencyContact,
                education,
                genres,
                reason,
            });
            toast(t('profile.saved'), 'ok');
            setEditing(false);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('profile.saveFailed'));
        }
        finally {
            setBusy(false);
        }
    };

    const pickAvatar = async (src) => {
        if (avatarBusy || src === user?.avatar) {
            setPickingAvatar(false);
            return;
        }
        setAvatarBusy(true);
        try {
            await updateAvatar(src);
            toast(t('profile.avatarSaved'), 'ok');
            setPickingAvatar(false);
        }
        catch (err) {
            toast(err instanceof Error ? err.message : t('profile.avatarFailed'));
        }
        finally {
            setAvatarBusy(false);
        }
    };

    const rows = [
        [t('profile.name'), user?.name ?? ''],
        [t('profile.userNo'), user?.id ?? ''],
        [t('profile.nickname'), user?.nickname ?? ''],
        [t('profile.age'), user?.age != null ? `${user.age} ${t('profile.years')}` : '—'],
        [t('profile.phone'), user?.phone || '—'],
        [t('profile.emergency'), user?.emergencyContact || '—'],
        [t('profile.education'), user?.education || '—'],
        [t('profile.genres'), user?.genres?.length ? user.genres.join(', ') : '—'],
        [t('profile.reason'), user?.reason || '—'],
    ];

    return (
      <div className="profile-page">
        <Card className="profile-hero-card">
          <div className="profile-hero">
            <div className="profile-avatar-block">
              <div className="avatar-lg">
                <img src={avatarSrc(user)} alt={user?.nickname ?? ''}/>
              </div>
              <Button
                ghost
                size="sm"
                type="button"
                disabled={avatarBusy}
                onClick={() => setPickingAvatar((open) => !open)}
              >
                {pickingAvatar ? t('profile.cancelAvatar') : t('profile.changeAvatar')}
              </Button>
            </div>
            <div className="profile-hero-meta">
              <div className="profile-name">{user?.nickname}</div>
              <div className="muted">{user?.name}</div>
              <div className="profile-badges">
                <Badge tone="blue">{roleLabel}</Badge>
                {user?.email && <Badge tone="green">{user.email}</Badge>}
              </div>
              {!editing && (
                <Button pink onClick={startEdit}>
                  {t('profile.edit')}
                </Button>
              )}
            </div>
          </div>

          {pickingAvatar && (
            <div className="avatar-picker">
              <div className="avatar-picker-label">{t('profile.pickAvatar')}</div>
              <div className="avatar-picker-grid">
                {PRESET_AVATARS.map((src) => {
                    const selected = user?.avatar === src || (!user?.avatar && avatarSrc(user) === src);
                    return (
                      <button
                        key={src}
                        type="button"
                        className={`avatar-pick ${selected ? 'on' : ''}`}
                        disabled={avatarBusy}
                        onClick={() => pickAvatar(src)}
                        aria-label={t('profile.pickAvatar')}
                      >
                        <img src={src} alt=""/>
                      </button>
                    );
                })}
              </div>
              <p className="muted avatar-picker-hint">{t('profile.avatarHint')}</p>
            </div>
          )}
        </Card>

        <div className="profile-sections">
          {editing ? (
            <Card title={t('profile.edit')}>
              <form onSubmit={save}>
                <Field label={t('profile.name')} required>
                  <Input value={name} onChange={(event) => setName(event.target.value)}/>
                </Field>
                <Field label={t('profile.nameEn')} required>
                  <Input placeholder={t('profile.nameEnPlaceholder')} value={nameEn} onChange={(event) => setNameEn(event.target.value)}/>
                </Field>
                <div className="two-col">
                  <Field label={t('profile.nickname')} required>
                    <Input value={nickname} onChange={(event) => setNickname(event.target.value)}/>
                  </Field>
                  <Field label={t('profile.nicknameEn')} required>
                    <Input placeholder={t('profile.nicknameEnPlaceholder')} value={nicknameEn} onChange={(event) => setNicknameEn(event.target.value)}/>
                  </Field>
                </div>
                <div className="two-col">
                  <Field label={t('profile.age')}>
                    <Input type="number" value={age} onChange={(event) => setAge(event.target.value)}/>
                  </Field>
                  <Field label={t('profile.phone')}>
                    <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)}/>
                  </Field>
                </div>
                <Field label={t('profile.emergency')}>
                  <Input value={emergencyContact} onChange={(event) => setEmergencyContact(event.target.value)}/>
                </Field>
                <Field label={t('profile.education')}>
                  <select className="input" value={education} onChange={(event) => setEducation(event.target.value)}>
                    <option value="">{t('auth.select')}</option>
                    {EDUCATION_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{language === 'en' ? item.en : item.th}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('profile.genres')}>
                  <div className="genre-row">
                    {GENRES.map((genre) => (
                      <span
                        key={genre.value}
                        className={`chk ${genres.includes(genre.value) ? 'on' : ''}`}
                        onClick={() => toggleGenre(genre.value)}
                      >
                        {language === 'en' ? genre.en : genre.th}
                      </span>
                    ))}
                  </div>
                </Field>
                <Field label={t('profile.reason')}>
                  <textarea className="input" rows={2} value={reason} onChange={(event) => setReason(event.target.value)}/>
                </Field>
                <div className="profile-form-actions">
                  <Button pink type="submit" disabled={busy} style={{ flex: 1 }}>
                    {busy ? t('profile.saving') : t('profile.save')}
                  </Button>
                  <Button ghost type="button" onClick={() => setEditing(false)}>{t('profile.cancelEdit')}</Button>
                </div>
              </form>
            </Card>
          ) : (
            <Card title={t('profile.member')}>
              {rows.map(([label, value]) => (
                <div className="info-row" key={label}>
                  <span className="muted">{label}</span>
                  <b>{value}</b>
                </div>
              ))}
              <div className="termbox" style={{ marginTop: 14 }}>
                {t('profile.pdpa')}
              </div>
            </Card>
          )}

          <Card title={t('profile.connections')}>
            <div className="profile-connect-row">
              <div>
                <div className="profile-connect-title">{t('profile.line')}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {user?.lineLinked ? t('profile.lineOn') : t('profile.lineOff')}
                </div>
              </div>
              {!user?.lineLinked && (
                <Button
                  line
                  type="button"
                  size="sm"
                  disabled={lineBusy}
                  onClick={async () => {
                      setLineBusy(true);
                      try {
                          await beginLineLogin('link');
                      }
                      catch (err) {
                          toast(err instanceof Error ? err.message : t('auth.lineFailed'));
                          setLineBusy(false);
                      }
                  }}
                >
                  {lineBusy ? t('auth.lineConnecting') : t('profile.lineConnect')}
                </Button>
              )}
              {user?.lineLinked && <Badge tone="green">{t('profile.lineOnShort')}</Badge>}
            </div>

            <div className="profile-connect-row">
              <div>
                <div className="profile-connect-title">{t('profile.googleCalendar')}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  {googleStatus?.configured
                    ? (googleStatus?.connected ? t('profile.googleConnected') : t('profile.googleCalendarHint'))
                    : t('profile.googleNotConfigured')}
                </div>
              </div>
              {googleStatus?.configured && (
                googleStatus?.connected ? (
                  <Button ghost size="sm" disabled={googleBusy} onClick={async () => {
                      setGoogleBusy(true);
                      try {
                          await api.disconnectStudentGoogleCalendar();
                          setGoogleStatus((prev) => ({ ...prev, connected: false }));
                          toast(t('profile.googleDisconnect'), 'ok');
                      }
                      catch (err) {
                          toast(err instanceof Error ? err.message : t('profile.googleNotConfigured'));
                      }
                      finally {
                          setGoogleBusy(false);
                      }
                  }}>
                    {t('profile.googleDisconnect')}
                  </Button>
                ) : (
                  <Button pink size="sm" disabled={googleBusy} onClick={async () => {
                      setGoogleBusy(true);
                      try {
                          await api.connectStudentGoogleCalendar();
                      }
                      catch (err) {
                          toast(err instanceof Error ? err.message : t('profile.googleNotConfigured'));
                          setGoogleBusy(false);
                      }
                  }}>
                    {t('profile.googleConnect')}
                  </Button>
                )
              )}
            </div>

            {oaQrUrl && (
              <div className="profile-oa">
                <div className="profile-connect-title">{t('profile.oaTitle')}</div>
                <div className="muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>{t('profile.oaHint')}</div>
                <img
                  src={oaQrUrl}
                  alt="LINE OA QR"
                  className="profile-oa-qr"
                />
                {oaAddFriendUrl && (
                  <div style={{ marginTop: 10 }}>
                    <a className="link" href={oaAddFriendUrl} target="_blank" rel="noreferrer">{t('profile.oaOpen')}</a>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
}
