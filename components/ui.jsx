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
export function Modal({ open, onClose, title, children }) {
    if (!open)
        return null;
    return (<div className="backdrop open" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <b>{title}</b>
          <button className="x" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
        <div className="mb">{children}</div>
      </div>
    </div>);
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
    return (<table>
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
    </table>);
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
