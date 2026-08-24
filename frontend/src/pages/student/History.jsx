import { useEffect, useState } from 'react';
import { Badge, Card, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';
export default function History() {
    const { language, t } = useApp();
    const [hist, setHist] = useState(null);
    useEffect(() => {
        api.getHistory().then(setHist);
    }, [language]);
    if (!hist)
        return <Spinner />;
    return (<Card title={t('history.title')} action={<Badge tone="green">{t('history.badge')}</Badge>}>
      <Table heads={[t('history.date'), t('history.time'), t('history.lesson'), t('history.note'), t('history.audio'), t('history.hours')]} rows={hist.map((h) => [
            <b key="d">{h.date}</b>,
            h.time,
            h.lesson,
            h.note,
            h.audioUrl ? <a key="a" href={h.audioUrl} target="_blank" rel="noreferrer">{t('history.audio')}</a> : '—',
            <Badge key="h" tone="blue">{h.usedHours} {t('history.hoursUnit')}</Badge>,
        ])}/>
    </Card>);
}
