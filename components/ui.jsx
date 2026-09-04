import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export function Button({ variant = 'pink', size, className = '', pink, green, line, ghost, danger, ...props }) {
    const v = pink ? 'pink' : green ? 'green' : line ? 'line' : ghost ? 'ghost' : danger ? 'danger' : variant;
    return (<button className={`btn ${v} ${size === 'sm' ? 'sm' : ''} ${className}`} {...props}/>);
}
/* ---------- Badge ---------- */
const badgeTones = ['green', 'amber', 'pink', 'gray', 'blue', 'red'];
export function Badge({ tone = 'green', children }) {
    return <span className={`badge ${tone}`}>{children}</span>;
}
/* ---------- Card ---------- */
export function Card({ title, action, children, className = '', }) {
    return (<div className={`card ${className}`}>
      {title && (<div className="card-h">
          <h3>{title}</h3>
          {action}
        </div>)}
      {children}
    </div>);
}
/* ---------- KPI ---------- */
const kpiTones = ['pink', 'blue', 'green', 'violet', 'gold'];
export function Kpi({ tone, icon, value, label, sub }) {
    return (<div className="card kpi">
      <div className={`ic ${tone}`}>{icon}</div>
      <div>
        <div className="v">{value}</div>
        <div className="l">{label}</div>
        <div className="sub">{sub}</div>
      </div>
    </div>);
}
/* ---------- Inputs / Fields ---------- */
export function Input(props) {
    return <input className="input" {...props}/>;
}
export function Field({ label, required, children }) {
    return (<div className="field">
      <label>
        {label} {required && <span className="req">*</span>}
      </label>
      {children}
    </div>);
}
/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, className = '', backdropClassName = '', headerActions = null }) {
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open, onClose]);

    if (!open) {
        return null;
    }

    return createPortal(
      <div
        className={`backdrop open ${backdropClassName}`.trim()}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`modal ${className}`.trim()} onClick={(event) => event.stopPropagation()}>
          <div className="mh">
            <b>{title}</b>
            <div className="mh-actions">
              {headerActions}
              <button type="button" className="x" onClick={onClose} aria-label="ปิด">
                ✕
              </button>
            </div>
          </div>
          <div className="mb">{children}</div>
        </div>
      </div>,
      document.body,
    );
}
/* ---------- Progress ---------- */
export function Progress({ value, max }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    return (<div className="prog">
      <i style={{ width: `${pct}%` }}/>
    </div>);
}
/* ---------- Spinner / Skeleton ---------- */
export function Spinner() {
    return (<div className="loading">
      <span className="spinner"/> กำลังโหลด…
    </div>);
}
export function Skeleton() {
    return (<div className="grid cols-3" style={{ marginBottom: 18 }}>
      {[0, 1, 2].map((i) => (<div key={i} className="card skeleton-box" style={{ height: 96 }}/>))}
    </div>);
}
/* ---------- Table helper ---------- */
export function Table({ heads, rows }) {
    return (<div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (<th key={h}>{h}</th>))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (<tr key={i}>
              {row.map((cell, j) => (<td key={j}>{cell}</td>))}
            </tr>))}
        </tbody>
      </table>
    </div>);
}
/* ---------- Stat (landing) ---------- */
export function Stat({ value, label }) {
    return (<div>
      <div className="v">{value}</div>
      <div className="l">{label}</div>
    </div>);
}
/* ---------- Misc ---------- */
export function PageHeader({ title, sub, right }) {
    return (<div className="pagehead">
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
      {right && <div className="right">{right}</div>}
    </div>);
}
export function Empty({ text }) {
    return <div className="empty">{text}</div>;
}
