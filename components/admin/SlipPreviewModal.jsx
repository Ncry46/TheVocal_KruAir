import { Modal } from '@components/ui';
import { AuthenticatedSlipImage } from './AuthenticatedSlipImage';

export function SlipPreviewModal({ open, onClose, refNo, mode = 'teacher', language = 'th' }) {
    const title = language === 'en' ? 'Transfer slip' : 'สลิปการโอน';
    const fetchPath = mode === 'student'
        ? `/purchases/${encodeURIComponent(refNo)}/slip`
        : `/teacher/payments/${encodeURIComponent(refNo)}/slip`;

    return (
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        className="slip-modal"
        backdropClassName="slip-backdrop"
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
