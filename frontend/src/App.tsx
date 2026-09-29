import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext.tsx'
import { Shell } from './components/Shell.tsx'
import { OfficeProvider } from './office/OfficeContext.tsx'
import { AlertsPage } from './pages/AlertsPage.tsx'
import { CallSlipPage } from './pages/CallSlipPage.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { LetterheadPage } from './pages/LetterheadPage.tsx'
import { OverviewPage } from './pages/OverviewPage.tsx'
import { SetupScreen, SignIn } from './pages/SignIn.tsx'
import { StudentRecord } from './pages/StudentRecord.tsx'
import { WaiverPage } from './pages/WaiverPage.tsx'

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { configured, loading, profile } = useAuth()
  if (!configured) return <SetupScreen />
  if (loading) return <p className="boot">Checking your session…</p>
  if (!profile) return <SignIn />
  return (
    <OfficeProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<OverviewPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/letterhead" element={<LetterheadPage />} />
            <Route path="/students/:studentId" element={<StudentRecord />} />
            <Route path="/students/:studentId/call-slip" element={<CallSlipPage />} />
            <Route path="/students/:studentId/waiver" element={<WaiverPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </HashRouter>
    </OfficeProvider>
  )
}
