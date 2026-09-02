import { useEffect, useState } from 'react';
import { getToken } from '@app/services/apiClient';

export function AuthenticatedSlipImage({
    fetchPath,
    alt,
    className,
    style,
    onClick,
    loadingLabel = 'กำลังโหลด…',
    failedLabel = 'โหลดสลิปไม่ได้',
}) {
    const [src, setSrc] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let objectUrl = '';
        let cancelled = false;
        (async () => {
            try {
                const token = getToken();
                const response = await fetch(`/api${fetchPath}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!response.ok) {
                    throw new Error('load failed');
                }
                const blob = await response.blob();
                objectUrl = URL.createObjectURL(blob);
                if (!cancelled) {
                    setSrc(objectUrl);
                    setFailed(false);
                }
            }
            catch {
                if (!cancelled) {
                    setFailed(true);
                    setSrc('');
                }
            }
        })();
        return () => {
            cancelled = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [fetchPath]);

    if (failed) {
        return <div className="slip-preview-status muted">{failedLabel}</div>;
    }
    if (!src) {
        return <div className="slip-preview-status muted">{loadingLabel}</div>;
    }
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        onClick={onClick}
      />
    );
}
