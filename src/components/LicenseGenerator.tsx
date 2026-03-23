import React, { useState } from 'react'
import { Key, Copy, CheckCircle, AlertTriangle } from 'lucide-react'
import { generateLicenseKey, TIER_PRICING, type LicenseTier } from '@/lib/license'

export const LicenseGenerator: React.FC = () => {
  const [selectedTier, setSelectedTier] = useState<LicenseTier>('NDGO')
  const [shopId, setShopId] = useState('')
  const [shopName, setShopName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [issuedKeys, setIssuedKeys] = useState<Array<{
    key: string
    tier: LicenseTier
    shopName: string
    issuedAt: string
  }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('b360_issued_keys') || '[]')
    } catch { return [] }
  })

  const handleGenerate = async () => {
    if (!shopName.trim()) { alert('Enter shop name.'); return }
    setGenerating(true)
    try {
      const id = shopId.trim() || crypto.randomUUID()
      const key = await generateLicenseKey(selectedTier, id)
      setGeneratedKey(key)

      // Save to local registry
      const newEntry = {
        key,
        tier: selectedTier,
        shopName: shopName.trim(),
        issuedAt: new Date().toISOString()
      }
      const updated = [newEntry, ...issuedKeys].slice(0, 100)
      setIssuedKeys(updated)
      localStorage.setItem('b360_issued_keys', JSON.stringify(updated))
    } finally {
      setGenerating(false)
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendViaWhatsApp = (key: string, name: string, tier: LicenseTier) => {
    const pricing = TIER_PRICING[tier]
    const msg = encodeURIComponent(
      `✅ *BIASHARA360 License Key*\n\n` +
      `Jina la Duka: *${name}*\n` +
      `Mpango: *${pricing.name}*\n` +
      `Bei: KSH ${pricing.price.toLocaleString()}\n\n` +
      `License Key yako:\n` +
      `*${key}*\n\n` +
      `Jinsi ya kutumia:\n` +
      `1. Fungua BIASHARA360\n` +
      `2. Bonyeza "Nina License Key"\n` +
      `3. Weka: ${key}\n` +
      `4. Bonyeza Activate\n\n` +
      `Asante kwa kutumia BIASHARA360! 🇰🇪`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Key size={14} className="text-brand" /> Generate License Key
        </h3>

        {/* Shop name */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-1 block">Shop / Business Name</label>
          <input
            className="input text-sm"
            placeholder="e.g. Alpha Ltd"
            value={shopName}
            onChange={e => setShopName(e.target.value)}
          />
        </div>

        {/* Select tier */}
        <div className="mb-3">
          <label className="text-xs text-gray-400 mb-2 block">License Tier</label>
          <div className="space-y-2">
            {(Object.entries(TIER_PRICING) as [LicenseTier, typeof TIER_PRICING[LicenseTier]][]).map(([tier, info]) => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-colors
                  ${selectedTier === tier
                    ? 'border-brand bg-brand/10'
                    : 'border-dark-border bg-dark-surface'}`}
              >
                <div>
                  <span className={`font-semibold ${selectedTier === tier ? 'text-brand' : 'text-white'}`}>
                    {info.name}
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{info.period}</span>
                </div>
                <span className={`font-bold ${selectedTier === tier ? 'text-brand' : 'text-gray-300'}`}>
                  KSH {info.price.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? <div className="spinner" /> : <><Key size={16} /> Generate Key</>}
        </button>
      </div>

      {/* Generated key display */}
      {generatedKey && (
        <div className="card border-brand/40 bg-brand/5">
          <p className="text-xs text-gray-400 mb-2">✅ License Key Generated</p>
          <div className="bg-dark-surface rounded-xl p-3 mb-3">
            <p className="font-mono text-base font-bold text-brand tracking-wider text-center">
              {generatedKey}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn-secondary py-2.5 text-xs"
              onClick={() => copyKey(generatedKey)}
            >
              {copied ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Copy Key</>}
            </button>
            <button
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-700 text-white text-xs font-semibold active:bg-green-800"
              onClick={() => sendViaWhatsApp(generatedKey, shopName, selectedTier)}
            >
              💬 Send WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* Warning */}
      <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3">
        <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-400 leading-relaxed">
          Only generate a key AFTER confirming M-Pesa payment. Each key is unique and tied to one business.
        </p>
      </div>

      {/* Issued keys registry */}
      {issuedKeys.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Recently Issued Keys ({issuedKeys.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {issuedKeys.map((entry, i) => (
              <div key={i} className="bg-dark-surface rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{entry.shopName}</span>
                  <span className="text-xs text-brand">{TIER_PRICING[entry.tier]?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-gray-400">{entry.key}</span>
                  <button onClick={() => copyKey(entry.key)} className="ml-2">
                    <Copy size={11} className="text-gray-500" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  {new Date(entry.issuedAt).toLocaleDateString('en-KE')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
