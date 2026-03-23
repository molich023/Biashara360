import React, { useState, useRef, useEffect } from 'react'
import { Camera, Check, User, Phone, ArrowLeft } from 'lucide-react'
import { db, getShop } from '@/db/local'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'

export const UserProfileScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { user, shop } = useAuth()
  const toast = useToast()
  const imgRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    photoUrl: '',
  })
  const [preview, setPreview] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: (user as unknown as { phone?: string }).phone || shop?.phone || '',
        photoUrl: (user as unknown as { photoUrl?: string }).photoUrl || '',
      })
      setPreview((user as unknown as { photoUrl?: string }).photoUrl || '')
    }
  }, [user, shop])

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setPreview(url)
      setForm(f => ({ ...f, photoUrl: url }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Enter your name.'); return }
    if (!form.phone.trim()) { toast.error('Enter your phone number.'); return }
    setSaving(true)
    try {
      if (user) {
        await db.users.where('id').equals(user.id).modify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          photoUrl: form.photoUrl,
        } as unknown as typeof user)
        toast.success('Profile updated!')
        onBack()
      }
    } catch {
      toast.error('Error saving. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div className="page-header">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title">My Profile</h1>
        <button onClick={handleSave} disabled={saving} className="text-brand font-bold">
          {saving ? '...' : <Check size={20} />}
        </button>
      </div>

      <div className="flex-1 px-4 pt-6 space-y-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => imgRef.current?.click()}
            className="w-24 h-24 rounded-full border-2 border-dashed border-dark-border bg-dark-card flex items-center justify-center cursor-pointer overflow-hidden active:border-brand relative"
          >
            {preview
              ? <img src={preview} alt="" className="w-full h-full object-cover" />
              : <User size={36} className="text-gray-500" />
            }
            <div className="absolute bottom-0 right-0 w-7 h-7 bg-brand rounded-full flex items-center justify-center">
              <Camera size={14} className="text-black" />
            </div>
          </div>
          <input ref={imgRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handlePhoto} />
          <p className="text-xs text-gray-400">Tap to add profile photo</p>
        </div>

        {/* Role badge */}
        <div className="flex justify-center">
          <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide
            ${user?.role === 'owner' ? 'bg-brand/20 text-brand border border-brand/40'
            : user?.role === 'manager' ? 'bg-blue-900/30 text-blue-400 border border-blue-700/40'
            : 'bg-dark-card text-gray-400 border border-dark-border'}`}>
            {user?.role || 'Cashier'}
          </span>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Full Name *</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input pl-10"
              placeholder="Your full name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Phone Number *</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input pl-10"
              placeholder="07XX XXX XXX"
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
        </div>

        {/* Shop info (read only) */}
        <div className="card">
          <p className="text-xs text-gray-400 mb-2">Business</p>
          <p className="font-semibold">{shop?.name}</p>
          <p className="text-xs text-gray-400 capitalize mt-0.5">{shop?.businessType}</p>
          {shop?.location && (
            <p className="text-xs text-gray-500 mt-0.5">
              {(shop.location as unknown as { county?: string; town?: string }).county},{' '}
              {(shop.location as unknown as { county?: string; town?: string }).town}
            </p>
          )}
        </div>

        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" /> : <><Check size={16} /> Save Profile</>}
        </button>
      </div>
    </div>
  )
}
