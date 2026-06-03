import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { POSPage } from './pages/POSPage'
import { CustomersPage } from './pages/CustomersPage'
import { VIPPage } from './pages/VIPPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CashbackPage } from './pages/CashbackPage'
import { SettingsPage } from './pages/SettingsPage'
import { useAppStore } from './store/app-store'
import { GlobalHotkeys } from './components/GlobalHotkeys'

function ManagerRoutes() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/vip" element={<VIPPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/cashback" element={<CashbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

function AppRoutes() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const loadSettings = useAppStore((s) => s.loadSettings)

  useEffect(() => {
    if (isAuthenticated) loadSettings()
  }, [isAuthenticated, loadSettings])

  if (!isAuthenticated) return <LoginPage />

  return (
    <>
      <GlobalHotkeys />
      <Routes>
        <Route path="/pos" element={<POSPage />} />
        <Route path="/*" element={<ManagerRoutes />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
      <Toaster position="top-center" richColors dir="rtl" />
    </HashRouter>
  )
}
