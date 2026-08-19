import { useState } from 'react'
import { Button, Card, Field, Modal } from '../../components/ui'
import { BellIcon, CheckIcon } from '../../components/icons'
import { useApp } from '../../context/AppContext'

const plus1 = (t: string) => String(Number(t.split(':')[0]) + 1).padStart(2, '0') + ':00'

const WEEK_DAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
const WEEK_DATES = ['18', '19', '20', '21', '22', '23', '24']
const TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']

interface SlotData {
  student: string
  lesson: string
  status: 'confirmed' | 'pending' | 'empty'
  note?: string
}

const MOCK_WEEK: Record<string, Record<string, SlotData>> = {
  'จ.': { '17:00': { student: 'น้องมิ้นท์', lesson: 'เทคนิคหายใจ + สเกล', status: 'confirmed' } },
  'อ.': {
    '10:00': { student: 'น้องเฟิร์น', lesson: 'Pop + สเกล', status: 'confirmed' },
    '11:00': { student: 'น้องมิน', lesson: 'Ballad', status: 'pending' },
    '15:00': { student: 'น้องต้นน้ำ', lesson: 'Rock', status: 'confirmed' },
    '17:00': { student: 'น้องมิ้นท์', lesson: 'เทคนิคหายใจ', status: 'confirmed' },
  },
  'พฤ.': {
    '13:00': { student: 'น้องเฟิร์น', lesson: 'R&B', status: 'confirmed' },
    '19:00': { student: 'น้องใหม่', lesson: 'Pop เบื้องต้น', status: 'confirmed' },
  },
  'ส.': {
    '10:00': { student: 'น้องต้นน้ำ', lesson: 'Rock + เสียงสูง', status: 'confirmed' },
    '14:00': { student: 'น้องมิ้นท์', lesson: 'Ballad', status: 'pending' },
  },
}

export default function Schedule() {
  const { toast } = useApp()
  const [selected, setSelected] = useState<{ day: string; time: string; data: SlotData } | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [logNote, setLogNote] = useState('')
  const [logBusy, setLogBusy] = useState(false)

  const handleCellClick = (day: string, time: string) => {
    const data = MOCK_WEEK[day]?.[time]
    if (!data) {
      setSelected(null)
      return
    }
    setSelected({ day, time, data })
  }

  const submitLog = async () => {
    if (!selected || logBusy) return
    setLogBusy(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      toast(`บันทึกผลการสอน ${selected.day} ${selected.time} แล้ว · หัก 1 ชม.`, 'ok')
      setLogOpen(false)
      setSelected(null)
    } finally {
      setLogBusy(false)
    }
  }

  return (
    <>
      <div className="alertbar">
        <BellIcon width={16} height={16} /> <b>1 นัดยังไม่คอนเฟิร์ม</b> (น้องมิน อ. 11:00)
      </div>

      <Card title="ตารางสอน · สัปดาห์ 18–24 ส.ค. 2569">
        <div className="cal-wrap">
          <div className="cal-corner"><span className="cal-corner-label">เวลา</span></div>

          {WEEK_DAYS.map((day, i) => {
            const count = MOCK_WEEK[day] ? Object.keys(MOCK_WEEK[day]).length : 0
            const today = day === 'อ.'
            return (
              <div key={day} className={`cal-day-head ${today ? 'today' : ''}`}>
                <span className="cdh-day">{day}</span>
                <span className="cdh-date">{WEEK_DATES[i]}</span>
                {count > 0 && <span className="cdh-count">{count}</span>}
              </div>
            )
          })}

          {TIMES.map((time) => (
            <div key={time} className="cal-row">
              <div className="cal-time"><span className="ct-hour">{time}</span></div>
              {WEEK_DAYS.map((day) => {
                const slotData = MOCK_WEEK[day]?.[time]
                const isActive = selected?.day === day && selected?.time === time
                return (
                  <div
                    key={day}
                    className={`cal-cell ${slotData ? 'has-data' : ''} ${isActive ? 'selected' : ''}`}
                    onClick={() => handleCellClick(day, time)}
                  >
                    {slotData ? (
                      <div className={`cal-chip ${slotData.status}`}>
                        {slotData.student.replace('น้อง', '')}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="cal-legend">
          <span className="cl-item"><span className="cl-chip confirmed" /> มีสอน</span>
          <span className="cl-item"><span className="cl-chip pending" /> รออนุมัติ</span>
          <span className="cl-item"><span className="cl-dot" style={{ background: 'var(--line)' }} /> ว่าง</span>
        </div>
      </Card>

      {/* Detail panel below calendar */}
      {selected && (
        <Card className="mt-16 detail-panel">
          <div className="dp-header">
            <div className="dp-info">
              <div className="dp-title">{selected.data.student}</div>
              <div className="dp-sub">{selected.day} {selected.time}–{plus1(selected.time)} · {selected.data.lesson}</div>
            </div>
            <span className={`dp-badge ${selected.data.status}`}>
              {selected.data.status === 'confirmed' ? 'ยืนยันแล้ว' : 'รอคอนเฟิร์ม'}
            </span>
          </div>

          <div className="dp-actions">
            {selected.data.status === 'confirmed' ? (
              <>
                <Button green onClick={() => { setLogNote(''); setLogOpen(true) }}>
                  <CheckIcon width={14} height={14} /> บันทึกผลการสอน
                </Button>
                <Button danger onClick={() => { toast(`บันทึก no-show ${selected.day} ${selected.time}`, 'ok'); setSelected(null) }}>
                  No-show
                </Button>
              </>
            ) : (
              <Button ghost onClick={() => { toast('ทวงถามอีกครั้ง', 'ok') }}>
                ทวงถาม
              </Button>
            )}
            <Button ghost onClick={() => setSelected(null)}>ปิด</Button>
          </div>
        </Card>
      )}

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="บันทึกผลการสอน">
        <div style={{ marginBottom: 16 }}>
          <div className="sumrow">
            <span className="muted">วัน-เวลา</span>
            <b>{selected?.day} {selected?.time}–{selected ? plus1(selected.time) : ''}</b>
          </div>
          <div className="sumrow">
            <span className="muted">นักเรียน</span>
            <b>{selected?.data.student}</b>
          </div>
          <div className="sumrow">
            <span className="muted">บทเรียน</span>
            <b>{selected?.data.lesson}</b>
          </div>
          <div className="sumrow">
            <span className="muted">หักชั่วโมง</span>
            <span className="disc">−1 ชม.</span>
          </div>
        </div>
        <Field label="บันทึกผลการสอน">
          <textarea
            className="classlog-input"
            placeholder="เช่น เทคนิคการหายใจ, ฝึก C3–C5..."
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
          />
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button green style={{ flex: 1 }} onClick={submitLog} disabled={logBusy}>
            {logBusy ? 'กำลังบันทึก…' : 'บันทึกผลการสอน'}
          </Button>
          <Button ghost onClick={() => setLogOpen(false)}>ยกเลิก</Button>
        </div>
      </Modal>
    </>
  )
}
