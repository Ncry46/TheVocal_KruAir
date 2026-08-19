const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
};
export function MicIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="17" x2="12" y2="22"/>
    </svg>);
}
export function PlayIcon(props) {
    return (<svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden="true" {...props}>
      <polygon points="6 3 20 12 6 21"/>
    </svg>);
}
export function MusicNoteIcon(props) {
    return (<svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor" aria-hidden="true" {...props}>
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>);
}
export function CrownIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <path d="M2 18h20"/>
      <path d="M3 7l4 4 5-7 5 7 4-4v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
    </svg>);
}
export function CheckIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <path d="M20 6 9 17l-5-5"/>
    </svg>);
}
export function HomeIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M3 10.5 12 3l9 7.5"/>
      <path d="M5 9.5V21h14V9.5"/>
      <path d="M10 21v-6h4v6"/>
    </svg>);
}
export function CartIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <circle cx="9" cy="20" r="1.6"/>
      <circle cx="17" cy="20" r="1.6"/>
      <path d="M2 3h3l2.6 12.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.2L20 7H6"/>
    </svg>);
}
export function BookIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/>
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>
    </svg>);
}
export function ReceiptIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z"/>
      <path d="M9 8h6M9 12h6"/>
    </svg>);
}
export function UserIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>
    </svg>);
}
export function RefreshIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66"/>
      <path d="M20 2v5h-5"/>
    </svg>);
}
export function TicketIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M2 9V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 0 0 6v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-6z"/>
      <path d="M13 5v2M13 11v2M13 17v2"/>
    </svg>);
}
export function GearIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>);
}
export function WrenchIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <path d="M14.7 6.3a1 1 0 0 0-1.4 0L10 9.6a4 4 0 0 1-5.5-5.5L7 6.5 6.5 7 3.5 4.5a4 4 0 0 0 5.5 5.5l3.3-3.3a1 1 0 0 0 0-1.4z"/>
      <path d="m10 9.6 3.4 3.4a2 2 0 0 1 0 2.8"/>
    </svg>);
}
export function LogoutIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="m16 17 5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>);
}
export function WalletIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M21 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/>
      <path d="M21 7h-8a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8z"/>
      <circle cx="16" cy="12" r="0.5" fill="currentColor"/>
    </svg>);
}
export function BankIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="m2 9 10-6 10 6"/>
      <path d="M4 9v9M9 9v9M15 9v9M20 9v9"/>
      <path d="M2 21h20"/>
      <path d="M2 18h20"/>
    </svg>);
}
export function GraduationIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <path d="M22 10 12 5 2 10l10 5 10-5z"/>
      <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>
      <path d="M22 10v6"/>
    </svg>);
}
export function TargetIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
    </svg>);
}
export function CalendarIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>);
}
export function CardIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <rect x="1" y="4" width="22" height="16" rx="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>);
}
export function BellIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>);
}
export function ChartIcon(props) {
    return (<svg {...base} width={22} height={22} aria-hidden="true" {...props}>
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>);
}
export function PinIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>);
}
export function ChatIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
    </svg>);
}
export function PhoneIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>);
}
export function ClockIcon(props) {
    return (<svg {...base} width={20} height={20} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>);
}
export function SunIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>);
}
export function MoonIcon(props) {
    return (<svg {...base} width={16} height={16} aria-hidden="true" {...props}>
      <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z"/>
    </svg>);
}
