import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/apiClient';
import { Logo } from '../Logo';
import { BellIcon, BookIcon, CalendarIcon, CartIcon, CheckIcon, ChartIcon, GearIcon, GraduationIcon, HomeIcon, LogoutIcon, MicIcon, ReceiptIcon, RefreshIcon, TicketIcon, UserIcon, WrenchIcon, } from '../icons';
const NAV = {
    student: [
        {
            group: 'nav.main',
            items: [
                { to: '/app', icon: <HomeIcon width={18} height={18}/>, label: 'nav.studentHome', end: true },
                { to: '/app/packages', icon: <CartIcon width={18} height={18}/>, label: 'nav.buyPackages' },
                { to: '/app/booking', icon: <CalendarIcon width={18} height={18}/>, label: 'nav.booking' },
                { to: '/app/history', icon: <BookIcon width={18} height={18}/>, label: 'nav.history' },
            ],
        },
        {
            group: 'nav.account',
            items: [
                { to: '/app/receipts', icon: <ReceiptIcon width={18} height={18}/>, label: 'nav.receipts' },
                { to: '/app/profile', icon: <UserIcon width={18} height={18}/>, label: 'nav.profile' },
            ],
        },
    ],
    teacher: [
        {
            group: 'pages.scheduleTitle',
            items: [
                { to: '/teacher', icon: <CalendarIcon width={18} height={18}/>, label: 'nav.schedule', end: true },
                { to: '/teacher/requests', icon: <RefreshIcon width={18} height={18}/>, label: 'nav.requests', badge: 2 },
                { to: '/teacher/students', icon: <GraduationIcon width={18} height={18}/>, label: 'nav.students' },
            ],
        },
    ],
    admin: [
        {
            group: 'nav.adminGroup',
            items: [
                { to: '/admin', icon: <ChartIcon width={18} height={18}/>, label: 'nav.sales', end: true },
                { to: '/admin/students', icon: <GraduationIcon width={18} height={18}/>, label: 'nav.manageStudents' },
                { to: '/admin/vouchers', icon: <TicketIcon width={18} height={18}/>, label: 'nav.vouchers' },
            ],
        },
        {
            group: 'nav.system',
            items: [{ to: '/admin/settings', icon: <GearIcon width={18} height={18}/>, label: 'nav.settings' }],
        },
    ],
};
const PAGE_TITLES = {
    '/app': { title: 'nav.studentHome', sub: 'pages.studentHomeSub' },
    '/app/packages': { title: 'nav.buyPackages', sub: 'pages.packagesSub' },
    '/app/booking': { title: 'nav.booking', sub: 'pages.bookingSub' },
    '/app/history': { title: 'nav.history', sub: 'pages.historySub' },
    '/app/receipts': { title: 'nav.receipts', sub: 'pages.receiptsSub' },
    '/app/profile': { title: 'nav.profile', sub: 'pages.profileSub' },
    '/teacher': { title: 'pages.scheduleTitle', sub: 'pages.scheduleSub' },
    '/teacher/requests': { title: 'nav.requests', sub: 'pages.requestsSub' },
    '/teacher/students': { title: 'nav.students', sub: 'pages.studentsSub' },
    '/admin': { title: 'nav.sales', sub: 'pages.salesSub' },
    '/admin/students': { title: 'nav.manageStudents', sub: 'pages.manageStudentsSub' },
    '/admin/vouchers': { title: 'nav.vouchers', sub: 'pages.vouchersSub' },
    '/admin/settings': { title: 'nav.settings', sub: 'pages.settingsSub' },
};
export function AppLayout({ mode }) {
    const { language, logout, setLanguage, t, theme, toggleTheme, user } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const [notifs, setNotifs] = useState(null);
    const [bellOpen, setBellOpen] = useState(false);
    const [reqCount, setReqCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isAdmin = mode === 'admin';
    const pageInfo = PAGE_TITLES[location.pathname] ?? (isAdmin
        ? { title: 'pages.scheduleTitle', sub: 'pages.scheduleSub' }
        : { title: 'nav.studentHome', sub: 'pages.studentHomeSub' });
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);
    useEffect(() => {
        api.getNotifications().then(setNotifs);
    }, []);
    const isStaff = mode === 'teacher' || mode === 'admin';
    useEffect(() => {
        if (!isStaff)
            return;
        api.getMoveRequests().then((rs) => setReqCount(rs.filter((r) => r.status === 'รออนุมัติ').length));
    }, [isStaff]);
    const unread = notifs?.filter((n) => !n.read).length ?? 0;
    const toggleBell = async () => {
        if (!bellOpen && unread > 0) {
            await api.markNotificationsRead();
            setNotifs((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
        }
        setBellOpen((v) => !v);
    };
    return (<div className="app">
      <aside className={`side ${sidebarOpen ? 'open' : ''}`}>
        <Logo size={42}/>

        <div className="role-badge">
          {mode === 'student' && <><GraduationIcon width={16} height={16}/> {t('roles.student')}</>}
          {mode === 'teacher' && <><MicIcon width={16} height={16}/> {t('roles.teacherBadge')}</>}
          {mode === 'admin' && <><WrenchIcon width={16} height={16}/> {t('roles.adminBadge')}</>}
        </div>

        <nav className="side-nav">
          {NAV[mode].map((g, gi) => (<div key={gi}>
              <div className="grp">{t(g.group)}</div>
              {g.items.map((item) => (<NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')} onClick={closeSidebar}>
                  <span className="ic">{item.icon}</span>
                  {t(item.label)}
                  {(item.to === '/teacher/requests' || item.to === '/admin/requests') && reqCount > 0 && <span className="nav-badge">{reqCount}</span>}
                </NavLink>))}
            </div>))}
        </nav>

        <div className="foot">
          <div className="status">
            <span className="dot"/> {language === 'en' ? 'Online' : 'ระบบออนไลน์'} · v0.1
          </div>
          <button className="back-site" onClick={() => { navigate('/'); closeSidebar(); }}>
            <HomeIcon width={15} height={15}/> {t('common.backToSite')}
          </button>
          <button className="logout" onClick={() => {
            logout();
            navigate('/');
        }}>
            <LogoutIcon width={15} height={15}/> {t('common.logout')}
          </button>
        </div>
      </aside>
      {sidebarOpen && <div className="side-overlay" onClick={closeSidebar}/>}

      <div className="main">
        <header className="topbar">
          <button className="hamburger" onClick={() => setSidebarOpen(true)} aria-label="เปิดเมนู">
            ☰
          </button>
          <div>
            <h2>{t(pageInfo.title)}</h2>
            <p className="crumb">{t(pageInfo.sub)}{mode === 'student' && location.pathname === '/app' ? ` · ${user?.nickname ?? ''}` : ''}</p>
          </div>
          <div className="spacer"/>
          <div className="pref-actions">
            <button className="pref-btn" type="button" onClick={() => setLanguage(language === 'th' ? 'en' : 'th')}>
              {language === 'th' ? 'EN' : 'TH'}
            </button>
            <button className="pref-btn" type="button" onClick={toggleTheme}>
              {theme === 'dark' ? '☀' : '☾'}
            </button>
          </div>
          <div className="bell-wrap">
            <button className="bell" aria-label="การแจ้งเตือน" onClick={toggleBell}>
              <BellIcon width={18} height={18}/>
              {unread > 0 && <span className="badge-num">{unread}</span>}
            </button>
            {bellOpen && (<div className="bell-panel">
                <div className="bell-head">
                  <b>{t('common.notifications')}</b>
                  <span>{unread > 0 ? `${unread} ${t('common.newMessages')}` : t('common.allRead')}</span>
                </div>
                {notifs && notifs.length > 0 ? (notifs.map((n) => (<div key={n.id} className={`bell-item ${n.read ? '' : 'new'}`}>
                      <div className={`bell-ic ${n.tone}`}>
                        {n.tone === 'green' ? (<CheckIcon width={15} height={15}/>) : n.tone === 'blue' ? (<CalendarIcon width={15} height={15}/>) : (<BellIcon width={15} height={15}/>)}
                      </div>
                      <div>
                        <b>{n.title}</b>
                        <p>{n.body}</p>
                        <span className="time">{n.time}</span>
                      </div>
                    </div>))) : (<div className="bell-empty">{t('common.noNotifications')}</div>)}
              </div>)}
          </div>
          <div className="user">
            <div className="ava">
              <img src={mode === 'student' ? '/img/av-1.jpg' : '/img/teacher-studio.jpg'} alt={user?.nickname ?? ''}/>
            </div>
            <div>
              <div className="nm">{user?.nickname ?? user?.name ?? ''}</div>
              <div className="rl">{mode === 'student' ? t('roles.student') : mode === 'teacher' ? t('roles.teacher') : t('roles.admin')}</div>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>);
}
