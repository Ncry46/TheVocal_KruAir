/* Monogram: elegant serif "K" whose lower arm ends in a music-note head */
export function KMarkIcon({ size = 24 }) {
    return (<svg viewBox="0 0 48 48" width={size} height={size} fill="none" aria-hidden="true">
      {/* stem */}
      <path d="M15 6.5v35" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round"/>
      {/* upper arm */}
      <path d="M18.5 25 32.5 9" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round"/>
      {/* lower arm ending in a note head */}
      <path d="M18.5 26.5 30.5 38.5" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round"/>
      <ellipse cx="35.2" cy="39.8" rx="3.7" ry="2.8" fill="currentColor" transform="rotate(-42 35.2 39.8)"/>
    </svg>);
}
export function LogoMark({ size = 46, light = false, className = '', style }) {
    return (<div className={`logo ${light ? 'light' : ''} ${className}`} style={{ width: size, height: size, ...style }}>
      <KMarkIcon size={Math.round(size * 0.5)}/>
    </div>);
}
export function Logo({ size = 46, light = false, text = 'ครูแอร์', sub = 'SINGING SCHOOL', onClick, className = '', style, }) {
    return (<div className={`brand ${className}`} onClick={onClick} style={style}>
      <LogoMark size={size} light={light}/>
      <div className="bt">
        <b>{text}</b>
        <span>{sub}</span>
      </div>
    </div>);
}
