import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Phone, Lock, ChevronRight, CheckCircle } from 'lucide-react'
import { db, saveShop, saveUser, generateSKU } from '@/db/local'
import { createPinHash } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { Shop, User, BusinessType } from '@/types'

const BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string }[] = [
  { value: 'kiosk',       label: 'Kiosk / Duka',       emoji: '🏪' },
  { value: 'minimarket',  label: 'Mini Market',         emoji: '🛒' },
  { value: 'supermarket', label: 'Supermarket',         emoji: '🏬' },
  { value: 'vegetable',   label: 'Mboga / Mama Mboga',  emoji: '🥬' },
  { value: 'salon',       label: 'Saloon / Kinyozi',    emoji: '✂️' },
  { value: 'pub',         label: 'Bar / Pab',           emoji: '🍺' },
  { value: 'hotel',       label: 'Hotel / Restaurant',  emoji: '🍽️' },
  { value: 'clothing',    label: 'Nguo / Mitumba',      emoji: '👗' },
  { value: 'shoes',       label: 'Viatu',               emoji: '👟' },
  { value: 'pharmacy',    label: 'Duka la Dawa',        emoji: '💊' },
  { value: 'hardware',    label: 'Hardware / Vifaa',    emoji: '🔧' },
  { value: 'butchery',    label: 'Nyama / Butchery',    emoji: '🥩' },
  { value: 'other',       label: 'Biashara Nyingine',   emoji: '💼' },
]

type Step = 'welcome' | 'shop' | 'mpesa' | 'pin' | 'done'

export const SetupScreen: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState<Step>('welcome')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    shopName: '',
    businessType: '' as BusinessType,
    phone: '',
    mpesaTill: '',
    pin: '',
    pinConfirm: ''
  })
  const [pinInput, setPinInput] = useState('')
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create')

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  // ─── STEP: WELCOME ─────────────────────────────────────────
  if (step === 'welcome') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🏪</div>
        <h1 className="text-3xl font-bold text-brand mb-2">BIASHARA360</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          POS ya biashara yako — rahisi, ya haraka, hata bila mtandao.
        </p>
      </div>

      <div className="w-full space-y-3 mb-8">
        {[
          { icon: '📵', text: 'Inafanya kazi bila mtandao' },
          { icon: '💳', text: 'M-Pesa STK Push moja kwa moja' },
          { icon: '📊', text: 'Ripoti ya kila siku mara moja' },
          { icon: '📦', text: 'Udhibiti wa stoki kwa urahisi' },
        ].map(f => (
          <div key={f.text} className="flex items-center gap-3 bg-dark-card border border-dark-border rounded-xl px-4 py-3 text-left">
            <span className="text-xl">{f.icon}</span>
            <span className="text-sm text-gray-300">{f.text}</span>
          </div>
        ))}
      </div>

      <button className="btn-primary" onClick={() => setStep('shop')}>
        Anza Sasa <ChevronRight size={18} />
      </button>
      <p className="mt-3 text-xs text-gray-500">Majaribio bure ya siku 7 — hakuna malipo sasa</p>
    </div>
  )

  // ─── STEP: SHOP INFO ────────────────────────────────────────
  if (step === 'shop') return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
        </div>
        <h2 className="text-xl font-bold mt-3">Jina la Duka Lako</h2>
        <p className="text-gray-400 text-sm">Habari ya msingi ya biashara yako</p>
      </div>

      <div className="space-y-4 flex-1">
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">Jina la Duka *</label>
          <input
            className="input"
            placeholder="Mfano: Duka la Mama Wanjiku"
            value={form.shopName}
            onChange={e => set('shopName', e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">Nambari ya Simu (Safaricom) *</label>
          <input
            className="input"
            placeholder="0712 345 678"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Aina ya Biashara *</label>
          <div className="grid grid-cols-2 gap-2">
            {BUSINESS_TYPES.map(bt => (
              <button
                key={bt.value}
                onClick={() => set('businessType', bt.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm text-left transition-colors
                  ${form.businessType === bt.value
                    ? 'border-brand bg-brand/10 text-brand font-semibold'
                    : 'border-dark-border bg-dark-card text-gray-300'}`}
              >
                <span>{bt.emoji}</span>
                <span className="text-xs leading-tight">{bt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          className="btn-primary"
          disabled={!form.shopName.trim() || !form.phone.trim() || !form.businessType}
          onClick={() => setStep('mpesa')}
        >
          Endelea <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )

  // ─── STEP: MPESA ────────────────────────────────────────────
  if (step === 'mpesa') return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
        </div>
        <h2 className="text-xl font-bold mt-3">Mipangilio ya M-Pesa</h2>
        <p className="text-gray-400 text-sm">Weka nambari yako ya kulipwa (si lazima sasa)</p>
      </div>

      <div className="space-y-4 flex-1">
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-lg">💳</div>
            <div>
              <div className="font-semibold text-sm">Lipa Na M-Pesa</div>
              <div className="text-xs text-gray-400">STK Push — mteja analipa moja kwa moja</div>
            </div>
          </div>
          <input
            className="input"
            placeholder="Nambari ya Till (mfano: 123456)"
            type="tel"
            inputMode="numeric"
            value={form.mpesaTill}
            onChange={e => set('mpesaTill', e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">
            Ikiwa huna Till number bado, unaweza kuruka hatua hii na kuongeza baadaye.
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-xs text-yellow-400 leading-relaxed">
            💡 <strong>Jinsi inavyofanya kazi:</strong> Unapokubali malipo ya M-Pesa, mfumo unatuma ombi la STK Push kwenye simu ya mteja. Mteja anaingiza PIN yake ya M-Pesa — pesa inakuja moja kwa moja kwenye akaunti yako.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button className="btn-primary" onClick={() => setStep('pin')}>
          Endelea <ChevronRight size={18} />
        </button>
        <button className="btn-secondary" onClick={() => setStep('pin')}>
          Ruka — Nitaongeza Baadaye
        </button>
      </div>
    </div>
  )

  // ─── STEP: PIN ──────────────────────────────────────────────
  const handlePinKey = (key: string) => {
    if (pinStep === 'create') {
      if (key === '⌫') { setPinInput(p => p.slice(0, -1)); return }
      if (pinInput.length >= 6) return
      const next = pinInput + key
      setPinInput(next)
      if (next.length === 6) {
        setTimeout(() => setPinStep('confirm'), 400)
      }
    } else {
      if (key === '⌫') { setPinConfirmInput(p => p.slice(0, -1)); return }
      if (pinConfirmInput.length >= 6) return
      const next = pinConfirmInput + key
      setPinConfirmInput(next)
      if (next.length === 6) {
        if (next !== pinInput) {
          toast.error('PIN hazilingani. Jaribu tena.')
          setPinInput('')
          setPinConfirmInput('')
          setPinStep('create')
        }
      }
    }
  }

  const currentPin = pinStep === 'create' ? pinInput : pinConfirmInput

  const handleFinish = async () => {
    if (pinInput.length !== 6 || pinConfirmInput !== pinInput) return
    setLoading(true)
    try {
      const shopId = crypto.randomUUID()
      const userId = crypto.randomUUID()
      const pinHash = await createPinHash(pinInput)
      const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const shop: Shop = {
        id: shopId,
        name: form.shopName.trim(),
        businessType: form.businessType,
        phone: form.phone.trim(),
        mpesaTill: form.mpesaTill.trim() || undefined,
        tier: 'trial',
        trialEnds,
        currency: 'KES',
        vatRate: 0,
        createdAt: new Date().toISOString()
      }

      const user: User = {
        id: userId,
        shopId,
        name: 'Mmiliki',
        role: 'owner',
        pinHash,
        isActive: true,
        createdAt: new Date().toISOString()
      }

      await saveShop(shop)
      await saveUser(user)
      setStep('done')
    } catch (err) {
      toast.error('Hitilafu imetokea. Jaribu tena.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'pin') return (
    <div className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-brand" />
        </div>
        <h2 className="text-xl font-bold mt-3">
          {pinStep === 'create' ? 'Weka PIN Yako' : 'Thibitisha PIN'}
        </h2>
        <p className="text-gray-400 text-sm">
          {pinStep === 'create'
            ? 'PIN ya siri 6 — itumike kuingia kwenye app'
            : 'Ingiza PIN tena ili kuthibitisha'}
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 my-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < currentPin.length ? 'filled' : ''}`} />
        ))}
      </div>

      {/* Keypad */}
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

      {/* Confirm button shows when both PINs match */}
      {pinStep === 'confirm' && pinConfirmInput.length === 6 && pinConfirmInput === pinInput && (
        <button
          className="btn-primary mt-8 w-full max-w-xs"
          onClick={handleFinish}
          disabled={loading}
        >
          {loading ? <div className="spinner" /> : <>Maliza Usanidi <CheckCircle size={18} /></>}
        </button>
      )}
    </div>
  )

  // ─── STEP: DONE ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4 animate-bounce">🎉</div>
      <h2 className="text-2xl font-bold text-brand mb-2">Umefanikiwa!</h2>
      <p className="text-gray-400 mb-2">
        <strong className="text-white">{form.shopName}</strong> imeandikishwa.
      </p>
      <p className="text-sm text-yellow-400 mb-8">
        🎁 Majaribio bure yanaanza leo — siku 7 kamili.
      </p>
      <button className="btn-primary" onClick={() => navigate('/login')}>
        Ingia Sasa <ChevronRight size={18} />
      </button>
    </div>
  )
}
