import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ToastProvider } from '@/lib/toast'
import { startSyncListener } from '@/lib/sync'
import { BottomNav } from '@/components/Layout/BottomNav'
import { SyncBar } from '@/components/Layout/SyncBar'
import { SetupScreen } from '@/pages/Setup'
import { LoginScreen } from '@/pages/Login'
import { SellScreen } from '@/pages/Sell'
import { StockScreen } from '@/pages/Stock'
import { ReportScreen } from '@/pages/Report'
import { SettingsScreen } from '@/pages/Settings'

// ─── AUTH GUARD ───────────────────────────────────────────────
const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isSetupComplete } = useAuth()
  const location = useLocation()

  if (!isSetupComplete) return <Navigate to="/setup" replace />
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

// ─── MAIN LAYOUT (authenticated shell) ────────────────────────
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col min-h-screen bg-dark-bg">
    <SyncBar />
    <main className="flex-1 flex flex-col overflow-hidden">
      {children}
    </main>
    <BottomNav />
  </div>
)

// ─── APP ROOT ─────────────────────────────────────────────────
const AppContent: React.FC = () => {
  const { isAuthenticated, isSetupComplete } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Start background sync listener
  useEffect(() => {
    const cleanup = startSyncListener(({ synced }) => {
      console.log(`Synced ${synced} records to server.`)
    })
    return cleanup
  }, [])

  // Redirect logic on mount
  useEffect(() => {
    if (!isSetupComplete && location.pathname !== '/setup') {
      navigate('/setup', { replace: true })
    } else if (isSetupComplete && !isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true })
    } else if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/')) {
      navigate('/sell', { replace: true })
    }
  }, [isAuthenticated, isSetupComplete])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/setup" element={<SetupScreen />} />
      <Route path="/login" element={<LoginScreen />} />

      {/* Protected routes — all need auth */}
      <Route path="/sell" element={
        <RequireAuth>
          <AppLayout><SellScreen /></AppLayout>
        </RequireAuth>
      } />
      <Route path="/stock" element={
        <RequireAuth>
          <AppLayout><StockScreen /></AppLayout>
        </RequireAuth>
      } />
      <Route path="/report" element={
        <RequireAuth>
          <AppLayout><ReportScreen /></AppLayout>
        </RequireAuth>
      } />
      <Route path="/settings" element={
        <RequireAuth>
          <AppLayout><SettingsScreen /></AppLayout>
        </RequireAuth>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="*" element={<Navigate to="/sell" replace />} />
    </Routes>
  )
}

// ─── ROOT EXPORT ──────────────────────────────────────────────
const App: React.FC = () => (
  <ToastProvider>
    <AppContent />
  </ToastProvider>
)

export default App
