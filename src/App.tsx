import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ToastProvider } from '@/lib/toast'
import { ThemeProvider } from '@/context/ThemeContext'
import { startSyncListener } from '@/lib/sync'
import { BottomNav } from '@/components/Layout/BottomNav'
import { SyncBar } from '@/components/Layout/SyncBar'
import { SetupScreen } from '@/pages/Setup'
import { LoginScreen } from '@/pages/Login'
import { SellScreen } from '@/pages/Sell'
import { StockScreen } from '@/pages/Stock'
import { ReportScreen } from '@/pages/Report'
import { SettingsScreen } from '@/pages/Settings'
import { AdminScreen } from '@/pages/Admin'
import { ForgotPinScreen } from '@/pages/ForgotPin'
import { TrialExpiredScreen } from '@/pages/TrialExpired'

// ─── TRIAL GATE ───────────────────────────────────────────────
const TrialGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isTrialExpired, shop, refreshShop } = useAuth()

  if (isTrialExpired && shop) {
    return (
      <TrialExpiredScreen
        shopName={shop.name}
        trialEnds={shop.trialEnds || new Date().toISOString()}
        onActivated={refreshShop}
      />
    )
  }

  return <>{children}</>
}

// ─── AUTH GUARD ───────────────────────────────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isSetupComplete } = useAuth()
  const location = useLocation()
  if (!isSetupComplete) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <TrialGate>{children}</TrialGate>
}

// ─── APP LAYOUT ───────────────────────────────────────────────
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col min-h-screen" style={{ background: 'var(--bg)' }}>
    <SyncBar />
    <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    <BottomNav />
  </div>
)

// ─── ROUTER ───────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const { isAuthenticated, isSetupComplete } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const cleanup = startSyncListener(({ synced }) => {
      console.log(`Synced ${synced} records.`)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const publicRoutes = ['/admin', '/forgot-pin']
    if (publicRoutes.includes(location.pathname)) return

    if (!isSetupComplete && location.pathname !== '/setup') {
      navigate('/setup', { replace: true })
    } else if (isSetupComplete && !isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    } else if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/')) {
      navigate('/sell', { replace: true })
    }
  }, [isAuthenticated, isSetupComplete, location.pathname])

  return (
    <Routes>
      {/* Public */}
      <Route path="/setup"      element={<SetupScreen />} />
      <Route path="/login"      element={<LoginScreen />} />
      <Route path="/admin"      element={<AdminScreen />} />
      <Route path="/forgot-pin" element={<ForgotPinScreen />} />

      {/* Protected + Trial Gated */}
      <Route path="/sell" element={
        <RequireAuth><AppLayout><SellScreen /></AppLayout></RequireAuth>
      } />
      <Route path="/stock" element={
        <RequireAuth><AppLayout><StockScreen /></AppLayout></RequireAuth>
      } />
      <Route path="/report" element={
        <RequireAuth><AppLayout><ReportScreen /></AppLayout></RequireAuth>
      } />
      <Route path="/settings" element={
        <RequireAuth><AppLayout><SettingsScreen /></AppLayout></RequireAuth>
      } />

      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="*" element={<Navigate to="/sell" replace />} />
    </Routes>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────
const App: React.FC = () => (
  <ThemeProvider>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </ThemeProvider>
)

export default App
