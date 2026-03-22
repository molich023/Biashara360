import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Users, MapPin, Globe, ArrowLeft, RefreshCw, Shield } from 'lucide-react'
import { db } from '@/db/local'

// ─── ADMIN PIN ─────────────────────────────────────────────────
// Change this to your own secret admin PIN
const ADMIN_PIN = '000000'

interface ShopSummary {
  id: string
  name: string
  businessType: string
  phone: string
  tier: string
  country: string
  county: string
  town: string
  createdAt: string
  trialEnds?: string
}

export const AdminScreen: React.FC = () => {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [shops, setShops] = useState<ShopSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [filterCountry, setFilterCountry] = useState('ALL')

  const handlePinKey = (key: string) => {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 6) return
    const next = pin + key
    setPin(next)
    if (next.length === 6) {
      if (next === ADMIN_PIN) {
        setAuthed(true)
        loadShops()
      } else {
        setError('Wrong admin PIN')
        setPin('')
      }
    }
  }

  const loadShops = async () => {
    setLoading(true)
    try {
      const all = await db.shops.toArray()
      const mapped: ShopSummary[] = all.map(s => ({
        id: s.id,
        name: s.name,
        businessType: s.businessType,
        phone: s.phone,
        tier: s.tier,
        country: (s as unknown as { location?: { country?: string } }).location?.country || 'KE',
        county: (s as unknown as { location?: { county?: string } }).location?.county || '',
        town: (s as unknown as { location?: { town?: string } }).location?.town || '',
        createdAt: s.createdAt,
        trialEnds: s.trialEnds,
      }))
      setShops(mapped)
    } finally {
      setLoading(false)
    }
  }

  // ─── STATS ────────────────────────────────────────────────────
  const total = shops.length
  const byCountry = shops.reduce((acc, s) => {
    acc[s.country] = (acc[s.country] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const byTier = shops.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const byType = shops.reduce((acc, s) => {
    acc[s.businessType] = (acc[s.businessType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const countries = ['ALL', ...Array.from(new Set(shops.map(s => s.country)))]

  const filtered = shops.filter(s => {
    const matchSearch = !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.town.toLowerCase().includes(filter.toLowerCase()) || s.county.toLowerCase().includes(filter.toLowerCase())
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

  // ─── PIN SCREEN ───────────────────────────────────────────────
  if (!authed) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <button onClick={() => navigate(-1)} className="absolute top-6 left-6 w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
        <ArrowLeft size={18} />
      </button>
      <Shield size={40} className="text-brand mb-4" />
      <h1 className="text-xl font-bold mb-1">Admin Dashboard</h1>
      <p className="text-sm text-gray-400 mb-8">Enter admin PIN to continue</p>

      <div className="flex gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button
            key={i}
            onClick={() => k && handlePinKey(k)}
            disabled={!k}
            className={`h-16 rounded-2xl text-xl font-bold transition-all
              ${k === '⌫' ? 'bg-dark-border text-brand text-base'
              : k ? 'bg-dark-card border border-dark-border text-white active:bg-brand active:text-black active:scale-95'
              : 'opacity-0'}`}
          >
            {k}
          </button>
        ))}
      </div>
      <p className="mt-8 text-xs text-gray-600">BIASHARA360 Admin · molich023</p>
    </div>
  )

  // ─── DASHBOARD ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-dark-surface border-b border-dark-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-bold text-sm">Admin Dashboard</h1>
            <p className="text-xs text-gray-400">BIASHARA360</p>
          </div>
        </div>
        <button onClick={loadShops} className="w-8 h-8 rounded-full bg-dark-card flex items-center justify-center">
          <RefreshCw size={14} className={loading ? 'animate-spin text-brand' : 'text-gray-400'} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-16">
        {/* Stats tiles */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-brand/10 border border-brand/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-brand" />
              <span className="text-xs text-gray-400">Total Businesses</span>
            </div>
            <div className="text-3xl font-bold text-brand">{total}</div>
          </div>
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={16} className="text-blue-400" />
              <span className="text-xs text-gray-400">Countries</span>
            </div>
            <div className="text-3xl font-bold text-blue-400">{Object.keys(byCountry).length}</div>
          </div>
        </div>

        {/* By Tier */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <BarChart2 size={14} /> Subscription Tiers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(byTier).map(([tier, count]) => (
              <div key={tier} className={`rounded-lg px-3 py-2 flex justify-between items-center ${tierColors[tier] || 'bg-dark-surface text-gray-400'}`}>
                <span className="text-xs font-semibold capitalize">{tier}</span>
                <span className="text-lg font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* By Country */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Globe size={14} /> By Country
          </h3>
          <div className="space-y-2">
            {Object.entries(byCountry).sort((a,b) => b[1]-a[1]).map(([country, count]) => (
              <div key={country} className="flex justify-between items-center">
                <span className="text-sm">{countryFlags[country] || '🌍'} {country}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-brand rounded-full" style={{ width: `${(count/total)*80}px` }} />
                  <span className="text-sm font-bold text-brand w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Business Type */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Business Types</h3>
          <div className="space-y-1.5">
            {Object.entries(byType).sort((a,b) => b[1]-a[1]).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-gray-300 capitalize">{type}</span>
                <span className="font-semibold text-brand">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="space-y-2">
          <input
            className="input text-sm"
            placeholder="Search by name, town, county..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {countries.map(c => (
              <button
                key={c}
                onClick={() => setFilterCountry(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
                  ${filterCountry === c ? 'bg-brand text-black border-brand' : 'bg-dark-card border-dark-border text-gray-400'}`}
              >
                {c === 'ALL' ? '🌍 All' : `${countryFlags[c] || ''} ${c}`}
              </button>
            ))}
          </div>
        </div>

        {/* Business List */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{filtered.length} businesses shown</p>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No businesses yet</p>
              <p className="text-gray-600 text-xs mt-1">Registered shops will appear here</p>
            </div>
          ) : (
            filtered.map(shop => (
              <div key={shop.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{shop.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{shop.businessType}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tierColors[shop.tier] || 'bg-dark-surface text-gray-400'}`}>
                    {shop.tier}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {countryFlags[shop.country] || '🌍'} {shop.county}{shop.town ? `, ${shop.town}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600 font-mono">{shop.phone}</span>
                  <span className="text-xs text-gray-600">
                    {new Date(shop.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
