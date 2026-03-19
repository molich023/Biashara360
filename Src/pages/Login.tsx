import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { getShop } from '@/db/local'
import type { Shop } from '@/types'

export const LoginScreen: React.FC = () => {
  const { login, isLockedOut, lockoutUntil } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shop, setShop] = useState<Shop | null>(null)
  const [lockMins, setLockMins] = useState(0)

  useEffect(() => {
    getShop().then(s => setShop(s || null))
  }, [])

  // Countdown for lockout
  useEffect(() => {
    if (!isLockedOut || !lockoutUntil) return
    const update = () => setLockMins(Math.ceil((lockoutUntil - Date.now()) / 60000))
    update()
    const interval = setInterval(update, 10000)
    return () => clearInterval(interval)
  }, [isLockedOut, lockoutUntil])

  const handleKey = async (key: string) => {
    if (isLockedOut || loading) return
    setError('')

    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (pin.length >= 6) return

    const next = pin + key
    setPin(next)

    if (next.length === 6) {
      setLoading(true)
      // Small delay so user sees 6th dot fill
      await new Promise(r => setTimeout(r, 300))
      const result = await login(next)
      if (result.success) {
        navigate('/sell', { replace: true })
      } else {
        setError(result.error || 'PIN si sahihi.')
        setPin('')
      }
      setLoading(false)
    }
  }

  const businessEmojis: Record<string, string> = {
    kiosk: '🏪', minimarket: '🛒', supermarket: '🏬', vegetable: '🥬',
    salon: '✂️', pub: '🍺', hotel: '🍽️', clothing: '👗', shoes: '👟',
    pharmacy: '💊', hardware: '🔧', butchery: '🥩', other: '💼'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Shop header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-2">
          {shop ? (businessEmojis[shop.businessType] || '🏪') : '🏪'}
        </div>
        <h1 className="text-xl font-bold text-brand">
          {shop?.name || 'BIASHARA360'}
        </h1>
        <p className="text-sm text-gray-400 mt-1">Ingiza PIN yako kuendelea</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`pin-dot transition-all duration-200
              ${i < pin.length
                ? loading ? 'bg-yellow-400 border-yellow-400 scale-110'
                  : 'bg-brand border-brand scale-110'
                : 'border-gray-600'}`}
          />
        ))}
      </div>

      {/* Error / lockout message */}
      {isLockedOut && (
        <div className="mb-6 bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-center max-w-xs">
          <p className="text-red-400 text-sm font-semibold">🔒 Imefungiwa kwa dakika {lockMins}</p>
          <p className="text-red-500 text-xs mt-1">Sababu ya PIN mbaya mara nyingi sana</p>
        </div>
      )}

      {error && !isLockedOut && (
        <div className="mb-6 bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 text-center max-w-xs">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
          <button
            key={i}
            onClick={() => k && handleKey(k)}
            disabled={!k || isLockedOut}
            className={`h-16 rounded-2xl text-xl font-bold transition-all select-none
              ${!k ? 'opacity-0 pointer-events-none'
              : isLockedOut ? 'bg-dark-card text-gray-600 cursor-not-allowed'
              : k === '⌫' ? 'bg-dark-border text-brand text-base active:scale-95'
              : 'bg-dark-card border border-dark-border text-white active:bg-brand active:text-black active:scale-95'}`}
          >
            {loading && k && pin.length === 6 ? '' : k}
          </button>
        ))}
      </div>

      {/* Trial reminder */}
      {shop?.tier === 'trial' && shop.trialEnds && (
        <div className="mt-8 text-center">
          <p className="text-xs text-yellow-500">
            🎁 Majaribio bure —{' '}
            {Math.max(0, Math.ceil((new Date(shop.trialEnds).getTime() - Date.now()) / 86400000))}{' '}
            siku zimebaki
          </p>
        </div>
      )}

      {/* Reset link (for lost PIN — shows after 3 errors) */}
      <button
        className="mt-6 text-xs text-gray-600 active:text-gray-400"
        onClick={() => navigate('/setup')}
      >
        <LogOut size={12} className="inline mr-1" />
        Duka lingine / Usanidi upya
      </button>
    </div>
  )
}
