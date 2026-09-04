import { useState } from 'react';
import { Button, Modal } from '@components/ui';
import { AuthenticatedSlipImage } from './AuthenticatedSlipImage';
import { downloadAuthenticatedSlip } from './downloadAuthenticatedSlip';

export function SlipPreviewModal({ open, onClose, refNo, mode = 'teacher', language = 'th', onToast }) {
    const [busy, setBusy] = useState(false);
    const title = language === 'en' ? 'Transfer slip' : 'สลิปการโอน';
    const downloadLabel = language === 'en' ? 'Download' : 'ดาวน์โหลด';
    const downloadingLabel = language === 'en' ? 'Downloading…' : 'กำลังดาวน์โหลด…';
    const fetchPath = mode === 'student'
        ? `/purchases/${encodeURIComponent(refNo)}/slip`
        : `/teacher/payments/${encodeURIComponent(refNo)}/slip`;

    const download = async () => {
        if (!refNo || busy) {
            return;
        }
        setBusy(true);
        try {
            await downloadAuthenticatedSlip(fetchPath, { filenameBase: `slip-${refNo}` });
            onToast?.(language === 'en' ? 'Slip downloaded' : 'ดาวน์โหลดสลิปแล้ว', 'ok');
        }
        catch {
            onToast?.(language === 'en' ? 'Could not download slip' : 'ดาวน์โหลดสลิปไม่สำเร็จ');
        }
        finally {
            setBusy(false);
        }
    };

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        className="slip-modal"
        backdropClassName="slip-backdrop"
        headerActions={refNo ? (
          <Button pink size="sm" type="button" disabled={busy} onClick={download}>
            {busy ? downloadingLabel : downloadLabel}
          </Button>
        ) : null}
      >
        {refNo ? (
          <div className="slip-preview-frame">
            <AuthenticatedSlipImage
              fetchPath={fetchPath}
              alt={title}
              className="slip-preview-img"
              loadingLabel={language === 'en' ? 'Loading slip…' : 'กำลังโหลดสลิป…'}
              failedLabel={language === 'en' ? 'Could not load slip' : 'โหลดสลิปไม่ได้'}
            />
          </div>
        ) : (
          <div className="empty">{language === 'en' ? 'No slip uploaded' : 'ไม่มีสลิป'}</div>
        )}
      </Modal>
    );
}
