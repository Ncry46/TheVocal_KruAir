import { useEffect, useState } from 'react';
import { Badge, Button, Card, Field, Input, Modal, Spinner, Table } from '@components/ui';
import { api } from '@app/services/apiClient';
import { useApp } from '@app/context/AppContext';

const EMPTY_FORM = {
    studentUserId: '',
    title: '',
    titleEn: '',
    hours: '1',
    totalAmount: '',
    installmentCount: '1',
};

export default function PaymentLinks() {
    const { language, t, toast } = useApp();
    const [links, setLinks] = useState(null);
    const [students, setStudents] = useState([]);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [busy, setBusy] = useState(false);

    const load = () => api.getTeacherPaymentLinks().then(setLinks);

    useEffect(() => {
        load().catch(() => setLinks([]));
        api.getStudents().then(setStudents).catch(() => setStudents([]));
    }, [language]);

    const copyLink = async (path) => {
        const url = `${window.location.origin}${path}`;
        try {
            await navigator.clipboard.writeText(url);
            toast(language === 'en' ? 'Link copied' : 'คัดลอกลิงก์แล้ว', 'ok');
        }
        catch {
            toast(url);
        }
    };

    const createLink = async () => {
        if (!form.studentUserId || !form.title.trim() || !form.totalAmount) {
            toast(language === 'en' ? 'Fill in all required fields' : 'กรุณากรอกข้อมูลให้ครบ');
            return;
        }
        setBusy(true);
        try {
            await api.createPaymentLink({
                studentUserId: Number(form.studentUserId),
                title: form.title.trim(),
                titleEn: form.titleEn.trim() || form.title.trim(),
                hours: Number(form.hours) || 1,
                totalAmount: Number(form.totalAmount),
                installmentCount: Number(form.installmentCount) || 1,
            });
            toast(language === 'en' ? 'Payment link created' : 'สร้างลิงก์ชำระเงินแล้ว', 'ok');
            setOpen(false);
            setForm(EMPTY_FORM);
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not create link' : 'สร้างลิงก์ไม่สำเร็จ'));
        }
        finally {
            setBusy(false);
        }
    };

    const cancelLink = async (id) => {
        if (!window.confirm(language === 'en' ? 'Cancel this payment link?' : 'ยกเลิกลิงก์นี้?')) {
            return;
        }
        setBusy(true);
        try {
            await api.cancelPaymentLink(id);
            toast(language === 'en' ? 'Link cancelled' : 'ยกเลิกลิงก์แล้ว', 'ok');
            await load();
        }
        catch (err) {
            toast(err instanceof Error ? err.message : (language === 'en' ? 'Could not cancel' : 'ยกเลิกไม่สำเร็จ'));
        }
        finally {
            setBusy(false);
        }
    };

    if (!links) {
        return <Spinner />;
    }

    const statusTone = (status) => {
        if (status === 'completed') {
            return 'green';
        }
        if (status === 'cancelled') {
            return 'gray';
        }
        return 'amber';
    };

    return (
      <div className="grid" style={{ gap: 16 }}>
        <Card
          title={language === 'en' ? 'Payment links' : 'ลิงก์ชำระเงิน'}
          action={<Button pink size="sm" onClick={() => setOpen(true)}>{language === 'en' ? '+ New link' : '+ สร้างลิงก์'}</Button>}
        >
          {links.length === 0 ? (
            <div className="empty">{language === 'en' ? 'No payment links yet' : 'ยังไม่มีลิงก์ชำระเงิน'}</div>
          ) : (
            <Table
              heads={[
                language === 'en' ? 'Student' : 'นักเรียน',
                language === 'en' ? 'Title' : 'รายการ',
                language === 'en' ? 'Amount' : 'ยอด',
                language === 'en' ? 'Installments' : 'งวด',
                language === 'en' ? 'Status' : 'สถานะ',
                '',
              ]}
              rows={links.map((link) => [
                link.student,
                link.title,
                `฿${Number(link.totalAmount).toLocaleString()}`,
                `${link.installmentsPaid}/${link.installmentCount}`,
                <Badge key={`s-${link.id}`} tone={statusTone(link.status)}>{link.status}</Badge>,
                <div key={`a-${link.id}`} style={{ display: 'flex', gap: 6 }}>
                  {link.status === 'active' && (
                    <>
                      <Button size="sm" ghost onClick={() => copyLink(link.payPath)} disabled={busy}>
                        {language === 'en' ? 'Copy' : 'คัดลอก'}
                      </Button>
                      <Button size="sm" ghost onClick={() => cancelLink(link.id)} disabled={busy}>
                        {language === 'en' ? 'Cancel' : 'ยกเลิก'}
                      </Button>
                    </>
                  )}
                </div>,
              ])}
            />
          )}
        </Card>

        <Modal open={open} onClose={() => setOpen(false)} title={language === 'en' ? 'Create payment link' : 'สร้างลิงก์ชำระเงิน'}>
          <Field label={language === 'en' ? 'Student' : 'นักเรียน'} required>
            <select className="input" value={form.studentUserId} onChange={(e) => setForm((current) => ({ ...current, studentUserId: e.target.value }))}>
              <option value="">{language === 'en' ? 'Select student' : 'เลือกนักเรียน'}</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </Field>
          <Field label={language === 'en' ? 'Title' : 'ชื่อรายการ'} required>
            <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}/>
          </Field>
          <div className="two-col">
            <Field label={language === 'en' ? 'Hours' : 'ชั่วโมง'} required>
              <Input type="number" min="1" value={form.hours} onChange={(e) => setForm((current) => ({ ...current, hours: e.target.value }))}/>
            </Field>
            <Field label={language === 'en' ? 'Amount (THB)' : 'ยอด (บาท)'} required>
              <Input type="number" min="0" value={form.totalAmount} onChange={(e) => setForm((current) => ({ ...current, totalAmount: e.target.value }))}/>
            </Field>
          </div>
          <Field label={t('paymentLinks.installmentCount')}>
            <Input type="number" min="1" max="12" value={form.installmentCount} onChange={(e) => setForm((current) => ({ ...current, installmentCount: e.target.value }))}/>
          </Field>
          <Button pink style={{ width: '100%' }} disabled={busy} onClick={createLink}>
            {busy ? (language === 'en' ? 'Creating…' : 'กำลังสร้าง…') : (language === 'en' ? 'Create link' : 'สร้างลิงก์')}
          </Button>
        </Modal>
      </div>
    );
}
