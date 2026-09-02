import { useEffect, useState } from 'react';
import { Modal, Spinner } from '@components/ui';
import { api } from '@app/services/apiClient';

export function SignaturePreviewModal({ open, onClose, bookingId, language = 'th' }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !bookingId) {
            setData(null);
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        api.getTeacherSignature(bookingId)
            .then((row) => {
                if (!cancelled) {
                    setData(row);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setData(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [open, bookingId]);

    const title = language === 'en' ? 'Student signature' : 'ลายเซ็นนักเรียน';
    const signedLabel = language === 'en' ? 'Signed at' : 'ลงชื่อเมื่อ';

    return (
      <Modal open={open} onClose={onClose} title={title}>
        {loading && <Spinner />}
        {!loading && !data && (
          <div className="empty">{language === 'en' ? 'Signature not found' : 'ไม่พบลายเซ็น'}</div>
        )}
        {!loading && data && (
          <div className="signature-review">
            <div className="sumrow">
              <span className="muted">{language === 'en' ? 'Student' : 'นักเรียน'}</span>
              <b>{data.student}</b>
            </div>
            <div className="sumrow">
              <span className="muted">{language === 'en' ? 'Lesson' : 'คลาส'}</span>
              <b>{data.date} · {data.time} · {data.lesson}</b>
            </div>
            {data.signedAt && (
              <div className="sumrow">
                <span className="muted">{signedLabel}</span>
                <b>{new Date(data.signedAt).toLocaleString(language === 'en' ? 'en-US' : 'th-TH')}</b>
              </div>
            )}
            {data.signature ? (
              <img src={data.signature} alt={title} className="signature-preview-img"/>
            ) : (
              <div className="empty" style={{ marginTop: 12 }}>
                {language === 'en' ? 'Waiting for student signature' : 'รอนักเรียนลงชื่อ'}
              </div>
            )}
          </div>
        )}
      </Modal>
    );
}
