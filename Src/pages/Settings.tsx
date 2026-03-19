import React from 'react'
import { LogOut, Bell, Shield, Info, ChevronRight, Store, Phone, CreditCard } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/lib/toast'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/local'
import { format } from 'date-fns'

export const SettingsScreen: React.FC = () => {
  const { shop, user, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const alertsCount = useLiveQuery(
    () => shop ? db.alerts.where({ shopId: shop.id, isRead: 0 as unknown as boolean }).count() : Promise.resolve(0),
    [shop?.id], 0
  )

  const pendingSync = useLiveQuery(() => db.syncQueue.count(), [], 0)

  const trialDaysLeft = shop?.trialEnds
    ? Math.max(0, Math.ceil((new Date(shop.trialEnds).getTime() - Date.now()) / 86400000))
    : 0

  const tierLabel: Record<string, string> = {
    trial: '🎁 Majaribio', ndogo: '🌱 Biashara Ndogo',
    kati: '🌿 Biashara Kati', kubwa: '🌳 Biashara Kubwa'
  }

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⚙️ Mipangilio</h1>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {/* Shop card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center">
              <Store size={22} className="text-brand" />
            </div>
            <div>
              <h2 className="font-bold text-base">{shop?.name}</h2>
              <p className="text-xs text-gray-400">{shop?.businessType} · {shop?.phone}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-dark-surface rounded-lg p-2">
              <span className="text-gray-500">Akaunti</span>
              <p className="font-semibold mt-0.5">{user?.name} ({user?.role})</p>
            </div>
            <div className="bg-dark-surface rounded-lg p-2">
              <span className="text-gray-500">M-Pesa Till</span>
              <p className="font-semibold mt-0.5">{shop?.mpesaTill || 'Haijawekwa'}</p>
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className={`card border ${shop?.tier === 'trial' ? 'border-yellow-700/50' : 'border-brand/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-brand" />
              <span className="font-semibold text-sm">Usajili</span>
            </div>
            <span className="badge badge-yellow">{tierLabel[shop?.tier || 'trial']}</span>
          </div>
          {shop?.tier === 'trial' ? (
            <div>
              <p className="text-sm text-yellow-400">Majaribio bure — siku <strong>{trialDaysLeft}</strong> zimebaki</p>
              <p className="text-xs text-gray-500 mt-1">
                Malipo: KSH 100/mwaka (Biashara Ndogo)
              </p>
              <button className="btn-primary mt-3 py-2.5 text-sm" onClick={() => toast.info('Usajili utapatikana hivi karibuni. Majaribio yanaendelea!')}>
                Sajili Sasa — KSH 100/mwaka
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Inaisha: {shop?.subscriptionExpires ? format(new Date(shop.subscriptionExpires), 'dd MMM yyyy') : 'Haijulikani'}
            </p>
          )}
        </div>

        {/* Alerts */}
        {alertsCount! > 0 && (
          <div className="card border border-red-700/40 bg-red-900/10">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-semibold">Arifa za Stoki Chini</p>
                <p className="text-xs text-gray-400">{alertsCount} bidhaa zina stoki ndogo</p>
              </div>
              <ChevronRight size={16} className="text-gray-500" />
            </div>
          </div>
        )}

        {/* Sync status */}
        {pendingSync! > 0 && (
          <div className="card border border-yellow-700/40">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-yellow-400" />
              <div>
                <p className="text-sm font-semibold text-yellow-400">Data Nje ya Mtandao</p>
                <p className="text-xs text-gray-500">{pendingSync} rekodi zinasubiri sync — zitapakiwa unapounganika</p>
              </div>
            </div>
          </div>
        )}

        {/* Menu items */}
        <div className="card divide-y divide-dark-border">
          {[
            { icon: Phone, label: 'Badilisha Nambari ya M-Pesa', action: () => toast.info('Inakuja hivi karibuni!') },
            { icon: Bell, label: 'Mipangilio ya Arifa', action: () => toast.info('Inakuja hivi karibuni!') },
            { icon: Shield, label: 'Mabadiliko ya PIN', action: () => toast.info('Inakuja hivi karibuni!') },
            { icon: Info, label: 'Kuhusu BIASHARA360 v1.0', action: () => toast.info('BIASHARA360 v1.0.0 — Toleo la Kwanza 🇰🇪') },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action} className="flex items-center gap-3 w-full py-3 text-left active:bg-dark-surface">
              <Icon size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm flex-1">{label}</span>
              <ChevronRight size={14} className="text-gray-600" />
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleLogout} className="btn-danger">
          <LogOut size={16} /> Toka kwenye Akaunti
        </button>

        <p className="text-center text-xs text-gray-600 pb-4">
          BIASHARA360 v1.0 · Made in 🇰🇪 Kenya · molich023
        </p>
      </div>
    </div>
  )
}
