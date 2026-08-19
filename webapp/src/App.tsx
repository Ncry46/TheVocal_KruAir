import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import { AppLayout } from './components/layout/AppLayout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/student/Home'
import Packages from './pages/student/Packages'
import Booking from './pages/student/Booking'
import History from './pages/student/History'
import Receipts from './pages/student/Receipts'
import Profile from './pages/student/Profile'
import Schedule from './pages/admin/Schedule'
import Requests from './pages/admin/Requests'
import Students from './pages/admin/Students'
import Sales from './pages/admin/Sales'
import Vouchers from './pages/admin/Vouchers'
import Settings from './pages/admin/Settings'

function RequireAuth({ roles }: { roles?: ('student' | 'teacher' | 'admin')[] }) {
  const { user } = useApp()
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<RequireAuth />}> 
        <Route path="/app" element={<AppLayout mode="student" />}>
          <Route index element={<Home />} />
          <Route path="packages" element={<Packages />} />
          <Route path="booking" element={<Booking />} />
          <Route path="history" element={<History />} />
          <Route path="receipts" element={<Receipts />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route element={<RequireAuth roles={['teacher', 'admin']} />}>
          <Route path="/teacher" element={<AppLayout mode="teacher" />}>
            <Route index element={<Schedule />} />
            <Route path="requests" element={<Requests />} />
            <Route path="students" element={<Students />} />
          </Route>
        </Route>

        <Route element={<RequireAuth roles={['admin']} />}>
          <Route path="/admin" element={<AppLayout mode="admin" />}>
            <Route index element={<Sales />} />
            <Route path="students" element={<Students />} />
            <Route path="vouchers" element={<Vouchers />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
