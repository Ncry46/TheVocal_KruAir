import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { Logo } from '../Logo';
import { BellIcon, BookIcon, CalendarIcon, CartIcon, CheckIcon, ChartIcon, GearIcon, GraduationIcon, HomeIcon, LogoutIcon, MicIcon, ReceiptIcon, RefreshIcon, TicketIcon, UserIcon, WrenchIcon, } from '../icons';
const NAV = {
    student: [
        {
            group: 'เมนูหลัก',
            items: [
                { to: '/app', icon: <HomeIcon width={18} height={18}/>, label: 'หน้าแรก', end: true },
                { to: '/app/packages', icon: <CartIcon width={18} height={18}/>, label: 'ซื้อแพ็กเกจ' },
                { to: '/app/booking', icon: <CalendarIcon width={18} height={18}/>, label: 'จองเวลาเรียน' },
                { to: '/app/history', icon: <BookIcon width={18} height={18}/>, label: 'ประวัติการเรียน' },
            ],
        },
        {
            group: 'บัญชีของฉัน',
            items: [
                { to: '/app/receipts', icon: <ReceiptIcon width={18} height={18}/>, label: 'ใบเสร็จ / การซื้อ' },
                { to: '/app/profile', icon: <UserIcon width={18} height={18}/>, label: 'โปรไฟล์' },
            ],
        },
    ],
    teacher: [
        {
            group: 'ตารางสอน',
            items: [
                { to: '/teacher', icon: <CalendarIcon width={18} height={18}/>, label: 'ตารางสอนวันนี้', end: true },
                { to: '/teacher/requests', icon: <RefreshIcon width={18} height={18}/>, label: 'คำขอเลื่อนนัด', badge: 2 },
                { to: '/teacher/students', icon: <GraduationIcon width={18} height={18}/>, label: 'ข้อมูลนักเรียน' },
            ],
        },
    ],
    admin: [
        {
            group: 'จัดการ (แอดมิน)',
            items: [
                { to: '/admin', icon: <ChartIcon width={18} height={18}/>, label: 'รายงาน / ยอดขาย', end: true },
                { to: '/admin/students', icon: <GraduationIcon width={18} height={18}/>, label: 'จัดการนักเรียน' },
                { to: '/admin/vouchers', icon: <TicketIcon width={18} height={18}/>, label: 'จัดการวอเชอร์' },
            ],
        },
        {
            group: 'ระบบ',
            items: [{ to: '/admin/settings', icon: <GearIcon width={18} height={18}/>, label: 'ตั้งค่าระบบ' }],
        },
    ],
};
const PAGE_TITLES = {
    '/app': { title: 'หน้าแรก', sub: 'Student Portal' },
    '/app/packages': { title: 'ซื้อแพ็กเกจ', sub: 'เลือกแพ็กเกจและชำระเงิน' },
    '/app/booking': { title: 'จองเวลาเรียน', sub: 'เลือกวัน-เวลาที่ว่าง' },
    '/app/history': { title: 'ประวัติการเรียน', sub: 'ดูบันทึกการสอนทั้งหมด' },
    '/app/receipts': { title: 'ใบเสร็จ / การซื้อ', sub: 'ประวัติการชำระเงิน' },
    '/app/profile': { title: 'โปรไฟล์', sub: 'ข้อมูลส่วนตัวของฉัน' },
    '/teacher': { title: 'ตารางสอน', sub: 'Teacher Dashboard · ครูแอร์' },
    '/teacher/requests': { title: 'คำขอเลื่อนนัด', sub: 'ตรวจสอบและอนุมัติ' },
    '/teacher/students': { title: 'ข้อมูลนักเรียน', sub: 'ดูข้อมูลนักเรียนทั้งหมด' },
    '/admin': { title: 'รายงาน / ยอดขาย', sub: 'Admin Dashboard · แอดมิน' },
    '/admin/students': { title: 'จัดการนักเรียน', sub: 'เพิ่ม/แก้ไข/ลบ นักเรียน' },
    '/admin/vouchers': { title: 'จัดการวอเชอร์', sub: 'สร้างและจัดการส่วนลด' },
    '/admin/settings': { title: 'ตั้งค่าระบบ', sub: 'การตั้งค่าทั่วไป' },
};
export function AppLayout({ mode }) {
    const { user, logout } = useApp();
    const navigate = useNavigate();
    const location = useLocation();
    const [notifs, setNotifs] = useState(null);
    const [bellOpen, setBellOpen] = useState(false);
    const [reqCount, setReqCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const isAdmin = mode === 'admin';
    const pageInfo = PAGE_TITLES[location.pathname] ?? (isAdmin
        ? { title: 'ตารางสอน', sub: 'Admin Dashboard · ครูแอร์' }
        : { title: 'หน้าแรก', sub: `Student Portal · น้อง${user?.nickname ?? ''}` });
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
          {mode === 'student' && <><GraduationIcon width={16} height={16}/> นักเรียน</>}
          {mode === 'teacher' && <><MicIcon width={16} height={16}/> ครูแอร์ · โค้ชเสียง</>}
          {mode === 'admin' && <><WrenchIcon width={16} height={16}/> แอดมิน · ผู้จัดการ</>}
        </div>

        <nav className="side-nav">
          {NAV[mode].map((g, gi) => (<div key={gi}>
              <div className="grp">{g.group}</div>
              {g.items.map((item) => (<NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'on' : '')} onClick={closeSidebar}>
                  <span className="ic">{item.icon}</span>
                  {item.label}
                  {(item.to === '/teacher/requests' || item.to === '/admin/requests') && reqCount > 0 && <span className="nav-badge">{reqCount}</span>}
                </NavLink>))}
            </div>))}
        </nav>

        <div className="foot">
          <div className="status">
            <span className="dot"/> ระบบออนไลน์ · v0.1
          </div>
          <button className="back-site" onClick={() => { navigate('/'); closeSidebar(); }}>
            <HomeIcon width={15} height={15}/> กลับหน้าเว็บไซต์
          </button>
          <button className="logout" onClick={() => {
            logout();
            navigate('/');
        }}>
            <LogoutIcon width={15} height={15}/> ออกจากระบบ
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
            <h2>{pageInfo.title}</h2>
            <p className="crumb">{pageInfo.sub}</p>
          </div>
          <div className="spacer"/>
          <div className="bell-wrap">
            <button className="bell" aria-label="การแจ้งเตือน" onClick={toggleBell}>
              <BellIcon width={18} height={18}/>
              {unread > 0 && <span className="badge-num">{unread}</span>}
            </button>
            {bellOpen && (<div className="bell-panel">
                <div className="bell-head">
                  <b>การแจ้งเตือน</b>
                  <span>{unread > 0 ? `${unread} ฉบับใหม่` : 'อ่านทั้งหมดแล้ว'}</span>
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
                    </div>))) : (<div className="bell-empty">ไม่มีการแจ้งเตือน</div>)}
              </div>)}
          </div>
          <div className="user">
            <div className="ava">
              <img src={mode === 'student' ? '/img/av-1.jpg' : '/img/teacher-studio.jpg'} alt={user?.nickname ?? ''}/>
            </div>
            <div>
              <div className="nm">{user?.nickname ?? user?.name ?? ''}</div>
              <div className="rl">{mode === 'student' ? 'นักเรียน' : mode === 'teacher' ? 'ครูแอร์' : 'แอดมิน'}</div>
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>);
}
