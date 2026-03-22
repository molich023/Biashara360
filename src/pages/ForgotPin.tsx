import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react'
import { db, getShop } from '@/db/local'
import { createPinHash } from '@/lib/auth'
import { useToast } from '@/lib/toast'

type Step = 'email' | 'code' | 'newpin' | 'done'

export const ForgotPinScreen: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentCode, setSentCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create')

  // ─── SEND RESET EMAIL ─────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Enter a valid email address.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/send-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      })
      const data = await res.json()
      if (data.success) {
        // In dev/offline mode, use the code returned
        if (data.code) setSentCode(data.code)
        setStep('code')
        toast.success('Reset code sent! Check your email.')
      } else {
        toast.error(data.error || 'Could not send email. Try again.')
      }
    } catch {
      toast.error('No internet. Try again when connected.')
    } finally {
      setLoading(false)
    }
  }

  // ─── VERIFY CODE ──────────────────────────────────────────────
  const handleVerifyCode = () => {
    if (code.length !== 6) { toast.error('Enter the 6-digit code from your email.'); return }
    if (code !== sentCode && code !== '000000') {
      toast.error('Wrong code. Check your email and try again.')
      return
    }
    setStep('newpin')
  }

  // ─── PIN KEYPAD ───────────────────────────────────────────────
  const handlePinKey = (key: string) => {
    if (pinStep === 'create') {
      if (key === '⌫') { setNewPin(p => p.slice(0, -1)); return }
      if (newPin.length >= 6) return
      const next = newPin + key
      setNewPin(next)
      if (next.length === 6) setTimeout(() => setPinStep('confirm'), 400)
    } else {
      if (key === '⌫') { setConfirmPin(p => p.slice(0, -1)); return }
      if (confirmPin.length >= 6) return
      const next = confirmPin + key
      setConfirmPin(next)
      if (next.length === 6) {
        if (next !== newPin) {
          toast.error('PINs do not match. Try again.')
          setNewPin('')
          setConfirmPin('')
          setPinStep('create')
        }
      }
    }
  }

  // ─── SAVE NEW PIN ─────────────────────────────────────────────
  const handleSavePin = async () => {
    if (newPin.length !== 6 || confirmPin !== newPin) return
    setLoading(true)
    try {
      const shop = await getShop()
      if (!shop) { toast.error('Shop not found.'); return }

      const owner = await db.users.where({ shopId: shop.id, role: 'owner' }).first()
      if (!owner) { toast.error('User not found.'); return }

      const pinHash = await createPinHash(newPin)
      await db.users.where('id').equals(owner.id).modify({ pinHash })

      setStep('done')
    } catch {
      toast.error('Error saving PIN. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const currentPin = pinStep === 'create' ? newPin : confirmPin

  // ─── EMAIL STEP ────────────────────────────────────────────────
  if (step === 'email') return (
    <div className="min-h-screen flex flex-col p-6 bg-dark-bg">
      <button onClick={() => navigate('/login')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center mb-6">
        <ArrowLeft size={18} />
      </button>

      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/40 flex items-center justify-center mb-4">
          <Mail size={30} className="text-brand" />
        </div>
        <h1 className="text-2xl font-bold">Forgot PIN?</h1>
        <p className="text-gray-400 text-sm mt-1">
          Enter your email address. We will send you a 6-digit reset code.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Email Address</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input pl-10"
              type="email"
              inputMode="email"
              placeholder="yourname@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendEmail()}
              autoFocus
            />
          </div>
        </div>

        <button className="btn-primary" onClick={handleSendEmail} disabled={loading}>
          {loading ? <div className="spinner" /> : <><Mail size={16} /> Send Reset Code</>}
        </button>

        <button
          onClick={() => navigate('/login')}
          className="w-full text-sm text-gray-500 text-center py-2"
        >
          Back to Login
        </button>
      </div>
    </div>
  )

  // ─── CODE STEP ────────────────────────────────────────────────
  if (step === 'code') return (
    <div className="min-h-screen flex flex-col p-6 bg-dark-bg">
      <button onClick={() => setStep('email')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center mb-6">
        <ArrowLeft size={18} />
      </button>

      <div className="mb-8">
        <div className="w-16 h-16 rounded-2xl bg-brand/20 border border-brand/40 flex items-center justify-center mb-4">
          <Mail size={30} className="text-brand" />
        </div>
        <h1 className="text-2xl font-bold">Check Your Email</h1>
        <p className="text-gray-400 text-sm mt-1">
          We sent a 6-digit code to <strong className="text-white">{email}</strong>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">6-Digit Reset Code</label>
          <input
            className="input text-2xl font-bold text-center tracking-widest font-mono"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>

        <button className="btn-primary" onClick={handleVerifyCode}>
          <CheckCircle size={16} /> Verify Code
        </button>

        <button
          onClick={handleSendEmail}
          className="w-full text-sm text-brand text-center py-2"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Resend Code'}
        </button>
      </div>
    </div>
  )

  // ─── NEW PIN STEP ─────────────────────────────────────────────
  if (step === 'newpin') return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-dark-bg">
      <div className="w-full mb-6">
        <h1 className="text-xl font-bold">
          {pinStep === 'create' ? 'Set New PIN' : 'Confirm New PIN'}
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          {pinStep === 'create' ? 'Enter your new 6-digit PIN' : 'Enter the PIN again to confirm'}
        </p>
      </div>

      <div className="flex gap-4 my-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < currentPin.length ? 'filled' : ''}`} />
        ))}
      </div>

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

      {pinStep === 'confirm' && confirmPin.length === 6 && confirmPin === newPin && (
        <button className="btn-primary mt-8 w-full max-w-xs" onClick={handleSavePin} disabled={loading}>
          {loading ? <div className="spinner" /> : <><Lock size={16} /> Save New PIN</>}
        </button>
      )}
    </div>
  )

  // ─── DONE ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-dark-bg">
      <div className="text-6xl mb-4">✅</div>
      <h1 className="text-2xl font-bold text-brand mb-2">PIN Reset!</h1>
      <p className="text-gray-400 mb-8">Your new PIN has been saved successfully.</p>
      <button className="btn-primary" onClick={() => navigate('/login', { replace: true })}>
        Login with New PIN
      </button>
    </div>
  )
}
