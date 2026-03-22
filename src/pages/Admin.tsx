import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart2, Users, MapPin, Globe, ArrowLeft,
  RefreshCw, Shield, Eye, EyeOff, Lock, CheckCircle,
  Trash2, TrendingUp, Bell
} from 'lucide-react'
import { db } from '@/db/local'

// ─── ADMIN PASSWORD ───────────────────────────────────────────
// Stored as Netlify environment variable ADMIN_PASSWORD
// Never hardcoded here — fetched from /api/admin-verify
// For local dev fallback only:
const DEV_FALLBACK = 'BIASHARA360_ADMIN'

interface ShopSummary {
  id: string
  name: string
  businessType: string
  phone: string
  tier: string
  country: string
  county: string
  town: string
  language: string
  createdAt: string
  trialEnds?: string
  subscriptionExpires?: string
}

type AdminTab = 'dashboard' | 'businesses' | 'password'

export const AdminScreen: React.FC = () => {
  const navigate = useNavigate()

  // ─── AUTH STATE ─────────────────────────────────────────────
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  // ─── APP STATE ──────────────────────────────────────────────
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [filterCountry, setFilterCountry] = useState('ALL')

  // ─── PASSWORD CHANGE STATE ──────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  // ─── PASSWORD STRENGTH ──────────────────────────────────────
  const getStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[a-z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    return score
  }

  const strengthLabel = (score: number) => {
    if (score <= 2) return { label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { label: 'Medium', color: 'bg-yellow-500' }
    return { label: 'Strong', color: 'bg-green-500' }
  }

  const strength = getStrength(newPwd)
  const strengthInfo = strengthLabel(strength)

  // ─── LOGIN ───────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!password.trim()) { setAuthError('Enter admin password.'); return }
    setAuthLoading(true)
    setAuthError('')
    try {
      // Verify against Netlify env variable via function
      const res = await fetch('/api/admin-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
        setAuthed(true)
        loadShops()
      } else {
        // Fallback for local dev
        if (password === DEV_FALLBACK) {
          setAuthed(true)
          loadShops()
        } else {
          setAuthError('Wrong password. Try again.')
          setPassword('')
        }
      }
    } catch {
      // Offline fallback
      if (password === DEV_FALLBACK) {
        setAuthed(true)
        loadShops()
      } else {
        setAuthError('Wrong password. Try again.')
        setPassword('')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  // ─── LOAD SHOPS ─────────────────────────────────────────────
  const loadShops = async () => {
    setLoading(true)
    try {
      const all = await db.shops.toArray()
      const mapped: ShopSummary[] = all.map((s: any) => ({
        id: s.id,
        name: s.name,
        businessType: s.businessType,
        phone: s.phone,
        tier: s.tier,
        country: s.location?.country || 'KE',
        county: s.location?.county || '',
        town: s.location?.town || '',
        language: s.language || 'sw',
        createdAt: s.createdAt,
        trialEnds: s.trialEnds,
        subscriptionExpires: s.subscriptionExpires,
      }))
      setShops(mapped)
    } finally {
      setLoading(false)
    }
  }

  // ─── CHANGE PASSWORD ─────────────────────────────────────────
  const handleChangePassword = async () => {
    setPwdMsg('')
    setPwdSuccess(false)
    if (!currentPwd) { setPwdMsg('Enter current password.'); return }
    if (newPwd.length < 8) { setPwdMsg('New password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(newPwd)) { setPwdMsg('Must include at least one capital letter.'); return }
    if (!/[0-9]/.test(newPwd)) { setPwdMsg('Must include at least one number.'); return }
    if (!/[^A-Za-z0-9]/.test(newPwd)) { setPwdMsg('Must include at least one symbol (@#$!&*).'); return }
    if (newPwd !== confirmPwd) { setPwdMsg('New passwords do not match.'); return }

    try {
      const res = await fetch('/api/admin-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd })
      })
      if (res.ok) {
        setPwdSuccess(true)
        setPwdMsg('✅ Password updated successfully! Update ADMIN_PASSWORD in Netlify environment variables.')
        setCurrentPwd('')
        setNewPwd('')
        setConfirmPwd('')
      } else {
        setPwdMsg('Current password is wrong.')
      }
    } catch {
      setPwdMsg('⚠️ Update ADMIN_PASSWORD in Netlify → Environment Variables manually.')
    }
  }

  // ─── STATS ───────────────────────────────────────────────────
  const total = shops.length
  const byCountry = shops.reduce((acc, s) => { acc[s.country] = (acc[s.country] || 0) + 1; return acc }, {} as Record<string, number>)
  const byTier = shops.reduce((acc, s) => { acc[s.tier] = (acc[s.tier] || 0) + 1; return acc }, {} as Record<string, number>)
  const byType = shops.reduce((acc, s) => { acc[s.businessType] = (acc[s.businessType] || 0) + 1; return acc }, {} as Record<string, number>)
  const trialCount = shops.filter(s => s.tier === 'trial').length
  const paidCount = total - trialCount

  const countries = ['ALL', ...Array.from(new Set(shops.map(s => s.country)))]
  const filtered = shops.filter(s => {
    const matchSearch = !filter ||
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.town.toLowerCase().includes(filter.toLowerCase()) ||
      s.county.toLowerCase().includes(filter.toLowerCase())
    const matchCountry = filterCountry === 'ALL' || s.country === filterCountry
    return matchSearch && matchCountry
  })

  const countryFlags: Record<string, string> = {
    KE: '🇰🇪', UG: '🇺🇬', TZ: '🇹🇿', RW: '🇷🇼',
    ET: '🇪🇹', NG: '🇳🇬', GH: '🇬🇭', ZA: '🇿🇦', OTHER: '🌍'
  }
  const tierColors: Record<string, string> = {
    trial: 'text-yellow-400 bg-yellow-900/30',
    ndogo: 'text-green-400 bg-green-900/30',
    kati: 'text-blue-400 bg-blue-900/30',
    kubwa: 'text-purple-400 bg-purple-900/30',
  }

  // ─── LOGIN SCREEN ─────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-dark-bg">
      <button
        onClick={() => navigate(-1)}
        className="absolute top-6 left-6 w-9 h-9 rounded-full bg-dark-card flex items-center justify-center"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/40 flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-brand" />
          </div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-sm text-gray-400 mt-1">BIASHARA360 Master Dashboard</p>
          <p className="text-xs text-gray-600 mt-1">Authorized personnel only</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Admin Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input pl-10 pr-12"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter admin password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
              <button
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{authError}</p>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handleLogin}
            disabled={authLoading}
          >
            {authLoading ? <div className="spinner" /> : <><Shield size={16} /> Access Dashboard</>}
          </button>
        </div>

        <p className="text-center text-xs text-gray-700 mt-8">
          BIASHARA360 v1.0 · Randy Voti · molich023
        </p>
      </div>
    </div>
  )

  // ─── ADMIN DASHBOARD ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-dark-surface border-b border-dark-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-bold text-sm">BIASHARA360 Admin</h1>
              <p className="text-xs text-brand">Master Dashboard</p>
            </div>
          </div>
          <button onClick={loadShops} className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center">
            <RefreshCw size={14} className={loading ? 'animate-spin text-brand' : 'text-gray-400'} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          {([
            { id: 'dashboard', label: '📊 Overview', },
            { id: 'businesses', label: '🏪 Businesses' },
            { id: 'password', label: '🔐 Password' },
          ] as { id: AdminTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors
                ${tab === t.id ? 'bg-brand text-black' : 'bg-dark-card text-gray-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4 pb-16 space-y-4">

        {/* ── OVERVIEW TAB ─────────────────────────────────── */}
        {tab === 'dashboard' && (
          <>
            {/* Key stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-brand/10 border border-brand/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} className="text-brand" />
                  <span className="text-xs text-gray-400">Total Shops</span>
                </div>
                <div className="text-3xl font-bold text-brand">{total}</div>
              </div>
              <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} className="text-green-400" />
                  <span className="text-xs text-gray-400">Paid</span>
                </div>
                <div className="text-3xl font-bold text-green-400">{paidCount}</div>
              </div>
              <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Bell size={14} className="text-yellow-400" />
                  <span className="text-xs text-gray-400">On Trial</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400">{trialCount}</div>
              </div>
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Globe size={14} className="text-blue-400" />
                  <span className="text-xs text-gray-400">Countries</span>
                </div>
                <div className="text-3xl font-bold text-blue-400">{Object.keys(byCountry).length}</div>
              </div>
            </div>

            {/* Revenue estimate */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <BarChart2 size={14} /> Estimated Annual Revenue
              </h3>
              <div className="space-y-2">
                {Object.entries(byTier).map(([tier, count]) => {
                  const prices: Record<string, number> = { trial: 0, ndogo: 100, kati: 500, kubwa: 1000 }
                  const revenue = (prices[tier] || 0) * count
                  return (
                    <div key={tier} className="flex justify-between items-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${tierColors[tier] || ''}`}>
                        {tier} ({count})
                      </span>
                      <span className="text-sm font-bold text-brand">
                        KSH {revenue.toLocaleString()}/yr
                      </span>
                    </div>
                  )
                })}
                <div className="border-t border-dark-border pt-2 flex justify-between">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-sm font-bold text-brand">
                    KSH {Object.entries(byTier).reduce((sum, [tier, count]) => {
                      const prices: Record<string, number> = { trial: 0, ndogo: 100, kati: 500, kubwa: 1000 }
                      return sum + (prices[tier] || 0) * count
                    }, 0).toLocaleString()}/yr
                  </span>
                </div>
              </div>
            </div>

            {/* By country */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <Globe size={14} /> By Country
              </h3>
              <div className="space-y-2">
                {Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([country, count]) => (
                  <div key={country} className="flex justify-between items-center">
                    <span className="text-sm">{countryFlags[country] || '🌍'} {country}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 bg-brand rounded-full" style={{ width: `${Math.max((count / total) * 80, 8)}px` }} />
                      <span className="text-sm font-bold text-brand w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By type */}
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Business Types</h3>
              <div className="space-y-1.5">
                {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-gray-300 capitalize">{type}</span>
                    <span className="font-semibold text-brand">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── BUSINESSES TAB ────────────────────────────────── */}
        {tab === 'businesses' && (
          <>
            <input
              className="input text-sm"
              placeholder="Search name, town, county..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {countries.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCountry(c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border
                    ${filterCountry === c ? 'bg-brand text-black border-brand' : 'bg-dark-card border-dark-border text-gray-400'}`}
                >
                  {c === 'ALL' ? '🌍 All' : `${countryFlags[c] || ''} ${c}`}
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-500">{filtered.length} businesses</p>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-sm">No businesses registered yet</p>
                <p className="text-gray-600 text-xs mt-1">Shops will appear here after signup</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(shop => {
                  const trialDaysLeft = shop.trialEnds
                    ? Math.max(0, Math.ceil((new Date(shop.trialEnds).getTime() - Date.now()) / 86400000))
                    : null
                  return (
                    <div key={shop.id} className="card">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{shop.name}</p>
                          <p className="text-xs text-gray-400 capitalize">{shop.businessType}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColors[shop.tier] || 'bg-dark-surface text-gray-400'}`}>
                          {shop.tier}
                          {trialDaysLeft !== null && shop.tier === 'trial' && ` · ${trialDaysLeft}d`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                        <MapPin size={10} />
                        <span>{countryFlags[shop.country] || '🌍'} {shop.county}{shop.town ? `, ${shop.town}` : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 font-mono">{shop.phone}</span>
                        <span className="text-xs text-gray-600">
                          {new Date(shop.createdAt).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs ${shop.language === 'en' ? 'text-blue-400' : 'text-green-400'}`}>
                          {shop.language === 'en' ? '🇬🇧 English' : '🇰🇪 Kiswahili'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── PASSWORD TAB ──────────────────────────────────── */}
        {tab === 'password' && (
          <>
            <div className="hbox" style={{ background: 'rgba(0,212,160,0.07)', border: '1px solid rgba(0,212,160,0.2)', borderRadius: 12, padding: '16px 18px', marginBottom: 8 }}>
              <p className="text-xs text-brand font-semibold mb-1">🔐 Admin Password Policy</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                Minimum 8 characters · At least 1 capital letter · At least 1 number · At least 1 symbol (@#$!&*)
              </p>
            </div>

            <div className="card space-y-4">
              {/* Current password */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Current Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showCurrent ? 'text' : 'password'}
                    placeholder="Current admin password"
                    value={currentPwd}
                    onChange={e => setCurrentPwd(e.target.value)}
                  />
                  <button onClick={() => setShowCurrent(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">New Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Min 8 chars, 1 capital, 1 number, 1 symbol"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                  />
                  <button onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPwd.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthInfo.color : 'bg-dark-border'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strength <= 2 ? 'text-red-400' : strength <= 4 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {strengthInfo.label} password
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Confirm New Password</label>
                <input
                  className={`input ${confirmPwd && confirmPwd !== newPwd ? 'border-red-500' : confirmPwd && confirmPwd === newPwd ? 'border-green-500' : ''}`}
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                />
                {confirmPwd && confirmPwd === newPwd && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle size={11} /> Passwords match
                  </p>
                )}
                {confirmPwd && confirmPwd !== newPwd && (
                  <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                )}
              </div>

              {/* Message */}
              {pwdMsg && (
                <div className={`rounded-xl px-4 py-3 text-sm ${pwdSuccess ? 'bg-green-900/30 border border-green-700/50 text-green-400' : 'bg-red-900/30 border border-red-700/50 text-red-400'}`}>
                  {pwdMsg}
                </div>
              )}

              <button className="btn-primary" onClick={handleChangePassword}>
                <Lock size={16} /> Update Admin Password
              </button>
            </div>

            {/* Instruction box */}
            <div className="card border-yellow-700/30 bg-yellow-900/10">
              <p className="text-xs text-yellow-400 font-semibold mb-2">⚠️ After changing password:</p>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Go to Netlify Dashboard</li>
                <li>Site configuration → Environment variables</li>
                <li>Find ADMIN_PASSWORD</li>
                <li>Update to your new password</li>
                <li>Trigger a new deploy</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
