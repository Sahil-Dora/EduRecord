import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Students } from './pages/Students'
import { StudentDetail } from './pages/StudentDetail'
import { Records } from './pages/Records'
import { RecordDetail } from './pages/RecordDetail'
import { Documents } from './pages/Documents'
import { DocumentDetail } from './pages/DocumentDetail'
import { Search } from './pages/Search'
import { Verification } from './pages/Verification'
import { ExpiryAlerts } from './pages/ExpiryAlerts'
import { UserManagement } from './pages/admin/UserManagement'
import { AuditHistory } from './pages/admin/AuditHistory'
import { Settings } from './pages/Settings'
import { NotFound } from './pages/NotFound'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/records" element={<Records />} />
        <Route path="/records/:id" element={<RecordDetail />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/search" element={<Search />} />
        <Route
          path="/verification"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <Verification />
            </ProtectedRoute>
          }
        />
        <Route path="/expiry" element={<ExpiryAlerts />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute roles={['admin']}>
              <AuditHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
