import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle, Key, Phone, Copy, ExternalLink } from 'lucide-react'
import { db, getShop, saveShop } from '@/db/local'
import { validateLicenseKeyFormat, getLicenseInfo, TIER_PRICING } from '@/lib/license'
import { useToast } from '@/lib/toast'
import type { LicenseTier } from '@/lib/license'

// ─── YOUR M-PESA TILL NUMBER ─────────────────────────────────
// Update this to your real M-Pesa Till number
const MPESA_TILL = '174379'       // ← Change to your real till
const MPESA_NAME = 'BIASHARA360'  // ← Your business name on M-Pesa
const SUPPORT_PHONE = '0704658022'
const SUPPORT_WHATSAPP = '254704658022'

interface Props {
  shopName: string
  trialEnds: string
  onActivated: () => void
}

export const TrialExpiredScreen: React.FC<Props> = ({ shopName, trialEnds, onActivated }) => {
  const toast = useToast()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pay' | 'activate'>('pay')
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [selectedTier, setSelectedTier] = useState<LicenseTier>('NDGO')

  const expiredDate = new Date(trialEnds).toLocaleDateString('en-KE', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const selectedPricing = TIER_PRICING[selectedTier]

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied!`)
    })
  }

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Habari! Nataka kulipia BIASHARA360 kwa ${shopName}.\n` +
      `Nimechagua: ${selectedPricing.name} — KSH ${selectedPricing.price.toLocaleString()}\n` +
      `Tafadhali nisaidie kupata license key.`
    )
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, '_blank')
  }

  const handleActivate = async () => {
    const key = licenseKey.trim().toUpperCase()

    if (!validateLicenseKeyFormat(key)) {
      toast.error('Invalid license key format. Check and try again.')
      return
    }

    const info = getLicenseInfo(key)
    if (!info) {
      toast.error('Could not read license key.')
      return
    }

    if (!info.isValid) {
      toast.error('This license key has expired.')
      return
    }

    setActivating(true)
    try {
      // Verify with server
      const res = await fetch('/api/activate-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })

      let serverValid = false
      if (res.ok) {
        const data = await res.json()
        serverValid = data.valid
      } else {
        // Offline fallback — basic format validation only
        serverValid = info.isValid
      }

      if (serverValid) {
        // Save license to shop
        const shop = await getShop()
        if (shop) {
          const expiryDate = info.isLifetime
            ? '2099-12-31T00:00:00.000Z'
            : info.expiryDate.toISOString()

          await db.shops.where('id').equals(shop.id).modify({
            tier: info.tier.toLowerCase() as 'ndogo' | 'kati' | 'kubwa',
            subscriptionExpires: expiryDate,
            licenseKey: key,
          } as unknown as typeof shop)

          toast.success('🎉 License activated! Welcome to BIASHARA360.')
          onActivated()
        }
      } else {
        toast.error('License key is not valid. Contact support.')
      }
    } catch {
      toast.error('Could not verify. Check internet and try again.')
    } finally {
      setActivating(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="bg-red-900/30 border-b border-red-700/50 px-4 py-4 text-center">
        <div className="text-3xl mb-2">🔒</div>
        <h1 className="text-lg font-bold text-red-400">Trial Period Ended</h1>
        <p className="text-sm text-gray-400 mt-1">
          <strong className="text-white">{shopName}</strong> — trial expired on {expiredDate}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-4">
        <button
          onClick={() => setTab('pay')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
            ${tab === 'pay' ? 'bg-brand text-black' : 'bg-dark-card text-gray-400 border border-dark-border'}`}
        >
          💳 Lipa Sasa
        </button>
        <button
          onClick={() => setTab('activate')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors
            ${tab === 'activate' ? 'bg-brand text-black' : 'bg-dark-card text-gray-400 border border-dark-border'}`}
        >
          🔑 Nina License Key
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">

        {/* ── PAY TAB ──────────────────────────────────────── */}
        {tab === 'pay' && (
          <div className="space-y-4">
            {/* Select tier */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Chagua mpango unaokufaa:</p>
              <div className="space-y-2">
                {(Object.entries(TIER_PRICING) as [LicenseTier, typeof TIER_PRICING[LicenseTier]][]).map(([tier, info]) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left
                      ${selectedTier === tier
                        ? 'border-brand bg-brand/10'
                        : 'border-dark-border bg-dark-card'}`}
                  >
                    <div>
                      <p className={`font-bold text-sm ${selectedTier === tier ? 'text-brand' : 'text-white'}`}>
                        {info.name}
                      </p>
                      <p className="text-xs text-gray-400">{info.period}</p>
                      <p className="text-xs text-gray-500">
                        {info.maxDevices === 999 ? 'Unlimited' : info.maxDevices} device{info.maxDevices > 1 ? 's' : ''}
                        {' · '}
                        {info.maxProducts >= 99999 ? 'Unlimited' : info.maxProducts} products
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${selectedTier === tier ? 'text-brand' : 'text-white'}`}>
                        KSH {info.price.toLocaleString()}
                      </p>
                      {selectedTier === tier && (
                        <CheckCircle size={16} className="text-brand ml-auto mt-1" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* M-Pesa payment instructions */}
            <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
              <h3 className="font-bold text-green-400 mb-3 flex items-center gap-2">
                <Phone size={16} /> Lipa na M-Pesa
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">1. Piga simu *M-Pesa#</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">2. Chagua Lipa Na M-Pesa</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">3. Chagua Buy Goods</span>
                </div>
                <div className="bg-dark-surface rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Till Number</span>
                    <button
                      onClick={() => copyToClipboard(MPESA_TILL, 'Till number')}
                      className="flex items-center gap-1 text-brand"
                    >
                      <span className="text-lg font-bold font-mono">{MPESA_TILL}</span>
                      <Copy size={14} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-400">Jina</span>
                    <span className="text-sm font-semibold">{MPESA_NAME}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Kiasi</span>
                    <span className="text-lg font-bold text-brand">
                      KSH {selectedPricing.price.toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  4. Baada ya kulipa, wasiliana nasi kupitia WhatsApp kupata license key yako.
                </p>
              </div>
            </div>

            {/* WhatsApp support */}
            <button
              onClick={openWhatsApp}
              className="w-full flex items-center justify-center gap-3 bg-green-700 active:bg-green-800 rounded-xl py-4 font-bold text-white"
            >
              <span className="text-xl">💬</span>
              Wasiliana Nasi (WhatsApp)
            </button>

            <div className="text-center">
              <p className="text-xs text-gray-500">Au piga simu:</p>
              <a href={`tel:${SUPPORT_PHONE}`} className="text-brand font-mono text-sm">
                {SUPPORT_PHONE}
              </a>
            </div>

            {/* Switch to activate */}
            <button
              onClick={() => setTab('activate')}
              className="w-full text-sm text-brand text-center py-2"
            >
              Tayari ninalipa? Weka license key →
            </button>
          </div>
        )}

        {/* ── ACTIVATE TAB ─────────────────────────────────── */}
        {tab === 'activate' && (
          <div className="space-y-4">
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <Key size={20} className="text-brand" />
                <div>
                  <p className="font-semibold text-sm">Enter License Key</p>
                  <p className="text-xs text-gray-400">Format: B360-XXXX-XXXX-XXXXXX-XX</p>
                </div>
              </div>
              <input
                className="input font-mono text-sm tracking-wider uppercase mb-3"
                placeholder="B360-XXXX-XXXX-XXXXXX-XX"
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                autoComplete="off"
                spellCheck={false}
              />
              {licenseKey.length > 5 && (
                <div className={`text-xs px-3 py-2 rounded-lg mb-3
                  ${validateLicenseKeyFormat(licenseKey.trim())
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'}`}
                >
                  {validateLicenseKeyFormat(licenseKey.trim())
                    ? '✅ Key format is valid'
                    : '❌ Invalid format — check your key'}
                </div>
              )}
              <button
                className="btn-primary"
                onClick={handleActivate}
                disabled={activating || !validateLicenseKeyFormat(licenseKey.trim())}
              >
                {activating
                  ? <><div className="spinner" /> Verifying...</>
                  : <><Key size={16} /> Activate License</>
                }
              </button>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
              <p className="text-xs text-yellow-400 leading-relaxed">
                💡 <strong>Huna license key?</strong> Lipa kwanza ukitumia M-Pesa kisha
                wasiliana nasi kupitia WhatsApp. Tutakutumia license key yako ndani ya dakika 30.
              </p>
            </div>

            <button
              onClick={openWhatsApp}
              className="w-full flex items-center justify-center gap-3 bg-green-700 active:bg-green-800 rounded-xl py-4 font-bold text-white"
            >
              <span className="text-xl">💬</span>
              WhatsApp Support
            </button>

            <button
              onClick={() => setTab('pay')}
              className="w-full text-sm text-gray-500 text-center py-2"
            >
              ← Back to payment options
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
