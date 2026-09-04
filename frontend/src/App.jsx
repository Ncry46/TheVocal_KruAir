import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { AppLayout } from '@components/layout/AppLayout';
import { AuthLayout } from '@components/layout/AuthLayout';
const Landing = lazy(() => import('./pages/Landing'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const Home = lazy(() => import('./pages/student/Home'));
const Packages = lazy(() => import('./pages/student/Packages'));
const Payment = lazy(() => import('./pages/student/Payment'));
const Homework = lazy(() => import('./pages/student/Homework'));
const Booking = lazy(() => import('./pages/student/Booking'));
const History = lazy(() => import('./pages/student/History'));
const Receipts = lazy(() => import('./pages/student/Receipts'));
const Profile = lazy(() => import('./pages/student/Profile'));
const Schedule = lazy(() => import('./pages/admin/Schedule'));
const Today = lazy(() => import('./pages/admin/Today'));
const StudentProfile = lazy(() => import('./pages/admin/StudentProfile'));
const PaymentLinks = lazy(() => import('./pages/admin/PaymentLinks'));
const Requests = lazy(() => import('./pages/admin/Requests'));
const Students = lazy(() => import('./pages/admin/Students'));
const Sales = lazy(() => import('./pages/admin/Sales'));
const Users = lazy(() => import('./pages/admin/Users'));
const Vouchers = lazy(() => import('./pages/admin/Vouchers'));
const AdminPayments = lazy(() => import('./pages/admin/Payments'));
const Settings = lazy(() => import('./pages/admin/Settings'));

function RouteFallback() {
    const { t } = useApp();
    return <div className="route-loading">{t('common.loading')}</div>;
}

function RequireAuth({ roles }) {
    const { user, liffBooting, t } = useApp();
    if (liffBooting) {
        return <div className="route-loading">{t('common.loading')}</div>;
    }
    if (!user)
        return <Navigate to="/login" replace/>;
    if (roles && !roles.includes(user.role))
        return <Navigate to="/app" replace/>;
    return <Outlet />;
}

function GuestOnly({ children }) {
    const { user } = useApp();
    if (user) {
        return <Navigate to="/" replace/>;
    }
    return children;
}
export default function App() {
    return (<Suspense fallback={<RouteFallback />}>
    <Routes>
        <Route path="/" element={<Landing />}/>
        <Route path="/privacy" element={<Privacy />}/>
        <Route path="/terms" element={<Terms />}/>
        <Route element={<GuestOnly><AuthLayout /></GuestOnly>}>
          <Route path="/login"/>
          <Route path="/register"/>
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppLayout mode="student"/>}>
            <Route index element={<Home />}/>
            <Route path="packages" element={<Packages />}/>
            <Route path="pay/:ref" element={<Payment />}/>
            <Route path="pay/link/:token" element={<Payment />}/>
            <Route path="homework" element={<Homework />}/>
            <Route path="booking" element={<Booking />}/>
            <Route path="history" element={<History />}/>
            <Route path="receipts" element={<Receipts />}/>
            <Route path="profile" element={<Profile />}/>
          </Route>

          <Route element={<RequireAuth roles={['teacher', 'admin']}/>}>
            <Route path="/teacher" element={<AppLayout mode="teacher"/>}>
              <Route index element={<Today />}/>
              <Route path="calendar" element={<Schedule />}/>
              <Route path="requests" element={<Requests />}/>
              <Route path="students" element={<Students />}/>
              <Route path="students/:id" element={<StudentProfile />}/>
              <Route path="sales" element={<Sales />}/>
              <Route path="payments" element={<AdminPayments />}/>
              <Route path="payment-links" element={<PaymentLinks />}/>
              <Route path="users" element={<Users />}/>
              <Route path="vouchers" element={<Vouchers />}/>
              <Route path="settings" element={<Settings />}/>
              <Route path="profile" element={<Profile />}/>
            </Route>
          </Route>
        </Route>

        <Route path="/admin" element={<Navigate to="/teacher" replace/>}/>
        <Route path="/admin/sales" element={<Navigate to="/teacher/sales" replace/>}/>
        <Route path="/admin/requests" element={<Navigate to="/teacher/requests" replace/>}/>
        <Route path="/admin/users" element={<Navigate to="/teacher/users" replace/>}/>
        <Route path="/admin/students" element={<Navigate to="/teacher/students" replace/>}/>
        <Route path="/admin/vouchers" element={<Navigate to="/teacher/vouchers" replace/>}/>
        <Route path="/admin/settings" element={<Navigate to="/teacher/settings" replace/>}/>
        <Route path="/admin/profile" element={<Navigate to="/teacher/profile" replace/>}/>
        <Route path="/admin/*" element={<Navigate to="/teacher" replace/>}/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>);
}
