import React, { useState } from 'react'
import {
  LogOut, Bell, Shield, Info, ChevronRight,
  Store, Phone, CreditCard, Palette, User,
  Download, Key, Sun, Moon, Leaf, Waves, Sunset
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/lib/toast'
import { useTheme, THEME_LABELS, type Theme } from '@/context/ThemeContext'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/local'
import { format } from 'date-fns'
import { UserProfileScreen } from '@/pages/UserProfile'

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  dark:   <Moon size={16} />,
  light:  <Sun size={16} />,
  forest: <Leaf size={16} />,
  ocean:  <Waves size={16} />,
  sunset: <Sunset size={16} />,
}

export const SettingsScreen: React.FC = () => {
  const { shop, user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const [showProfile, setShowProfile] = useState(false)
  const [showThemes, setShowThemes] = useState(false)
  const [showLicense, setShowLicense] = useState(false)
  const [licenseKey, setLicenseKey] = useState('')

  const alertsCount = useLiveQuery(
    () => shop ? db.alerts.where({ shopId: shop.id, isRead: 0 as unknown as boolean }).count() : Promise.resolve(0),
    [shop?.id], 0
  )

  const pendingSync = useLiveQuery(() => db.syncQueue.count(), [], 0)

  const trialDaysLeft = shop?.trialEnds
    ? Math.max(0, Math.ceil((new Date(shop.trialEnds).getTime() - Date.now()) / 86400000))
    : 0

  const tierLabel: Record<string, string> = {
    trial: '🎁 Trial',
    mama: '🥬 Mama Mboga',
    ndogo: '🌱 Biashara Ndogo',
    kati: '🌿 Biashara Kati',
    kubwa: '🌳 Biashara Kubwa',
    entp: '🏢 Enterprise'
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleBackup = async () => {
    try {
      const [products, sales, alerts] = await Promise.all([
        db.products.toArray(),
        db.sales.toArray(),
        db.alerts.toArray(),
      ])
      const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        shop,
        products,
        sales: sales.slice(-1000), // last 1000 sales
        alerts,
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `biashara360-backup-${format(new Date(), 'yyyy-MM-dd')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded! Save it to Google Drive.')
    } catch {
      toast.error('Backup failed. Try again.')
    }
  }

  // Show profile screen
  if (showProfile) return <UserProfileScreen onBack={() => setShowProfile(false)} />

  return (
    <div className="page" style={{ background: 'var(--bg)' }}>
      <div className="page-header">
        <h1 className="page-title">⚙️ Settings</h1>
      </div>

      <div className="px-4 pt-3 space-y-4">

        {/* ── USER PROFILE ─────────────────────────────────── */}
        <button
          onClick={() => setShowProfile(true)}
          className="card w-full text-left flex items-center gap-3 active:opacity-80"
        >
          <div className="w-12 h-12 rounded-full bg-brand/20 border border-brand/40 flex items-center justify-center overflow-hidden flex-shrink-0">
            {(user as unknown as { photoUrl?: string })?.photoUrl
              ? <img src={(user as unknown as { photoUrl?: string }).photoUrl} alt="" className="w-full h-full object-cover" />
              : <User size={22} className="text-brand" />
            }
          </div>
          <div className="flex-1">
            <p className="font-bold">{user?.name || 'Set your name'}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role} · {shop?.name}</p>
            {!(user as unknown as { photoUrl?: string })?.photoUrl && (
              <p className="text-xs text-brand mt-0.5">+ Add photo & phone</p>
            )}
          </div>
          <ChevronRight size={16} className="text-gray-500" />
        </button>

        {/* ── SHOP CARD ─────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center">
              <Store size={18} className="text-brand" />
            </div>
            <div>
              <h2 className="font-bold text-sm">{shop?.name}</h2>
              <p className="text-xs text-gray-400 capitalize">{shop?.businessType} · {shop?.phone}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-dark-surface rounded-lg p-2">
              <span className="text-gray-500">User</span>
              <p className="font-semibold mt-0.5 capitalize">{user?.role}</p>
            </div>
            <div className="bg-dark-surface rounded-lg p-2">
              <span className="text-gray-500">M-Pesa Till</span>
              <p className="font-semibold mt-0.5">{shop?.mpesaTill || 'Not set'}</p>
            </div>
          </div>
        </div>

        {/* ── SUBSCRIPTION ──────────────────────────────────── */}
        <div className={`card border ${shop?.tier === 'trial' ? 'border-yellow-700/50' : 'border-brand/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-brand" />
              <span className="font-semibold text-sm">Subscription</span>
            </div>
            <span className="badge badge-yellow">{tierLabel[shop?.tier || 'trial']}</span>
          </div>
          {shop?.tier === 'trial' ? (
            <div>
              <p className="text-sm text-yellow-400">
                Free trial — <strong>{trialDaysLeft}</strong> days remaining
              </p>
              <button
                className="btn-primary mt-3 py-2.5 text-sm"
                onClick={() => setShowLicense(true)}
              >
                <Key size={14} /> Activate License
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400">
                Expires: {shop?.subscriptionExpires
                  ? format(new Date(shop.subscriptionExpires), 'dd MMM yyyy')
                  : 'Lifetime'}
              </p>
              <button
                className="btn-secondary mt-2 py-2 text-xs"
                onClick={() => setShowLicense(true)}
              >
                <Key size={12} /> Enter New License Key
              </button>
            </div>
          )}
        </div>

        {/* License key modal */}
        {showLicense && (
          <div className="card border-brand/30">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Key size={14} className="text-brand" /> Enter License Key
            </p>
            <input
              className="input font-mono text-sm uppercase tracking-wider mb-3"
              placeholder="B360-XXXX-XXXX-XXXXXX-XX"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value.toUpperCase())}
            />
            <div className="flex gap-2">
              <button className="btn-primary flex-1 py-2.5 text-sm" onClick={() => {
                toast.info('License activation — go to the payment screen from login page.')
                setShowLicense(false)
              }}>
                Activate
              </button>
              <button className="btn-secondary flex-1 py-2.5 text-sm" onClick={() => setShowLicense(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── THEME ─────────────────────────────────────────── */}
        <div className="card">
          <button
            onClick={() => setShowThemes(s => !s)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-3">
              <Palette size={16} className="text-brand" />
              <div>
                <p className="font-semibold text-sm">Theme</p>
                <p className="text-xs text-gray-400">
                  {THEME_ICONS[theme]} {THEME_LABELS[theme].emoji} {THEME_LABELS[theme].label}
                </p>
              </div>
            </div>
            <ChevronRight size={14} className={`text-gray-500 transition-transform ${showThemes ? 'rotate-90' : ''}`} />
          </button>

          {showThemes && (
            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-dark-border">
              {(Object.keys(THEME_LABELS) as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTheme(t); toast.info(`${THEME_LABELS[t].emoji} ${THEME_LABELS[t].label} theme applied`) }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors
                    ${theme === t
                      ? 'border-brand bg-brand/10 text-brand font-semibold'
                      : 'border-dark-border bg-dark-surface text-gray-300'}`}
                >
                  <span>{THEME_LABELS[t].emoji}</span>
                  <span>{THEME_LABELS[t].label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── ALERTS ────────────────────────────────────────── */}
        {alertsCount! > 0 && (
          <div className="card border border-red-700/40 bg-red-900/10">
            <div className="flex items-center gap-3">
              <Bell size={16} className="text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Low Stock Alerts</p>
                <p className="text-xs text-gray-400">{alertsCount} products running low</p>
              </div>
              <ChevronRight size={14} className="text-gray-500" />
            </div>
          </div>
        )}

        {/* ── SYNC STATUS ───────────────────────────────────── */}
        {pendingSync! > 0 && (
          <div className="card border border-yellow-700/40">
            <div className="flex items-center gap-3">
              <Shield size={14} className="text-yellow-400" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">Offline Data Pending</p>
                <p className="text-xs text-gray-500">{pendingSync} records waiting to sync</p>
              </div>
            </div>
          </div>
        )}

        {/* ── MENU ITEMS ────────────────────────────────────── */}
        <div className="card divide-y divide-dark-border">
          {[
            { icon: Download, label: 'Backup My Data', action: handleBackup, color: 'text-blue-400' },
            { icon: Phone, label: 'Change M-Pesa Number', action: () => toast.info('Coming soon!') },
            { icon: Bell, label: 'Notification Settings', action: () => toast.info('Coming soon!') },
            { icon: Shield, label: 'Change PIN', action: () => navigate('/forgot-pin') },
            { icon: Info, label: 'About BIASHARA360 v1.0', action: () => toast.info('BIASHARA360 v1.0 🇰🇪 — Built in Ngong Hills') },
          ].map(({ icon: Icon, label, action, color }) => (
            <button key={label} onClick={action} className="flex items-center gap-3 w-full py-3 text-left active:opacity-70">
              <Icon size={16} className={color || 'text-gray-400'} />
              <span className="text-sm flex-1">{label}</span>
              <ChevronRight size={14} className="text-gray-600" />
            </button>
          ))}
        </div>

        {/* ── IDLE TIMER INFO ───────────────────────────────── */}
        <div className="card bg-dark-surface/50">
          <p className="text-xs text-gray-500 text-center">
            🔒 Auto-locks after 10 minutes of inactivity
          </p>
        </div>

        {/* ── LOGOUT ────────────────────────────────────────── */}
        <button onClick={handleLogout} className="btn-danger">
          <LogOut size={16} /> Sign Out
        </button>

        <p className="text-center text-xs text-gray-600 pb-4">
          BIASHARA360 v1.0 · molich023 · Ngong Hills, Kenya 🇰🇪
        </p>
      </div>
    </div>
  )
}
