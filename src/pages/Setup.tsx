import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CheckCircle, Globe } from 'lucide-react'
import { saveShop, saveUser } from '@/db/local'
import { createPinHash } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { Shop, User, BusinessType } from '@/types'

// ─── TRANSLATIONS ─────────────────────────────────────────────
type Lang = 'sw' | 'en'

const T = {
  sw: {
    welcome_title: 'Karibu BIASHARA360',
    welcome_sub: 'POS ya biashara yako — rahisi, ya haraka, hata bila mtandao.',
    feature1: 'Inafanya kazi bila mtandao',
    feature2: 'M-Pesa STK Push moja kwa moja',
    feature3: 'Ripoti ya kila siku mara moja',
    feature4: 'Udhibiti wa stoki kwa urahisi',
    start: 'Anza Sasa',
    trial: 'Majaribio bure ya siku 7 — hakuna malipo sasa',
    choose_lang: 'Chagua Lugha / Choose Language',
    step_shop: 'Jina la Duka Lako',
    step_shop_sub: 'Habari ya msingi ya biashara yako',
    shop_name: 'Jina la Duka *',
    shop_name_ph: 'Mfano: Duka la Mama Wanjiku',
    phone: 'Nambari ya Simu (Safaricom) *',
    phone_ph: '0712 345 678',
    country: 'Nchi *',
    county: 'Kaunti / Mkoa *',
    town: 'Mji / Eneo *',
    town_ph: 'Mfano: Ngong, CBD, Westlands',
    business_type: 'Aina ya Biashara *',
    continue: 'Endelea',
    step_mpesa: 'Mipangilio ya M-Pesa',
    step_mpesa_sub: 'Weka nambari yako ya kulipwa (si lazima sasa)',
    till_ph: 'Nambari ya Till (mfano: 123456)',
    till_hint: 'Ikiwa huna Till number bado, unaweza kuruka hatua hii.',
    mpesa_how: 'Jinsi inavyofanya kazi: Unapokubali malipo ya M-Pesa, mfumo unatuma ombi la STK Push kwenye simu ya mteja.',
    skip: 'Ruka — Nitaongeza Baadaye',
    step_pin: 'Weka PIN Yako',
    step_pin_confirm: 'Thibitisha PIN',
    pin_sub: 'PIN ya siri 6 — itumike kuingia kwenye app',
    pin_confirm_sub: 'Ingiza PIN tena ili kuthibitisha',
    pin_mismatch: 'PIN hazilingani. Jaribu tena.',
    finish: 'Maliza Usanidi',
    done_title: 'Umefanikiwa!',
    done_sub: 'imeandikishwa.',
    done_trial: 'Majaribio bure yanaanza leo — siku 7 kamili.',
    login_now: 'Ingia Sasa',
    error_name: 'Weka jina la duka.',
    error_phone: 'Weka nambari ya simu.',
    error_type: 'Chagua aina ya biashara.',
    error_country: 'Chagua nchi.',
    error_county: 'Weka kaunti au mkoa.',
    error_town: 'Weka jina la mji au eneo.',
  },
  en: {
    welcome_title: 'Welcome to BIASHARA360',
    welcome_sub: 'Your business POS — simple, fast, works even without internet.',
    feature1: 'Works offline — no internet needed',
    feature2: 'M-Pesa STK Push payments',
    feature3: 'Daily reports in one tap',
    feature4: 'Easy stock management',
    start: 'Get Started',
    trial: '7-day free trial — no payment now',
    choose_lang: 'Chagua Lugha / Choose Language',
    step_shop: 'Your Business Details',
    step_shop_sub: 'Basic information about your business',
    shop_name: 'Business Name *',
    shop_name_ph: 'e.g. Mama Wanjiku\'s Shop',
    phone: 'Phone Number (Safaricom) *',
    phone_ph: '0712 345 678',
    country: 'Country *',
    county: 'County / Region *',
    town: 'Town / Area *',
    town_ph: 'e.g. Ngong, CBD, Westlands',
    business_type: 'Business Type *',
    continue: 'Continue',
    step_mpesa: 'M-Pesa Settings',
    step_mpesa_sub: 'Add your payment number (optional for now)',
    till_ph: 'Till Number (e.g. 123456)',
    till_hint: 'If you don\'t have a Till number yet, you can skip this step.',
    mpesa_how: 'How it works: When you accept M-Pesa, the system sends an STK Push request to the customer\'s phone.',
    skip: 'Skip — Add Later',
    step_pin: 'Set Your PIN',
    step_pin_confirm: 'Confirm PIN',
    pin_sub: '6-digit secret PIN — used to log into the app',
    pin_confirm_sub: 'Enter PIN again to confirm',
    pin_mismatch: 'PINs do not match. Try again.',
    finish: 'Complete Setup',
    done_title: 'Success!',
    done_sub: 'has been registered.',
    done_trial: 'Your free trial starts today — full 7 days.',
    login_now: 'Login Now',
    error_name: 'Enter your business name.',
    error_phone: 'Enter your phone number.',
    error_type: 'Select a business type.',
    error_country: 'Select a country.',
    error_county: 'Enter your county or region.',
    error_town: 'Enter your town or area.',
  }
}

// ─── COUNTRIES ────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'KE', name: 'Kenya', currency: 'KES', flag: '🇰🇪' },
  { code: 'UG', name: 'Uganda', currency: 'UGX', flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania', currency: 'TZS', flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda', currency: 'RWF', flag: '🇷🇼' },
  { code: 'ET', name: 'Ethiopia', currency: 'ETB', flag: '🇪🇹' },
  { code: 'NG', name: 'Nigeria', currency: 'NGN', flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana', currency: 'GHS', flag: '🇬🇭' },
  { code: 'ZA', name: 'South Africa', currency: 'ZAR', flag: '🇿🇦' },
  { code: 'OTHER', name: 'Other', currency: 'USD', flag: '🌍' },
]

// ─── KENYA COUNTIES ───────────────────────────────────────────
const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu',
  'Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho',
  'Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui','Kwale',
  'Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit',
  'Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya',
  'Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia',
  'Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'
]

// ─── BUSINESS TYPES ───────────────────────────────────────────
const getBizTypes = (lang: Lang) => [
  { value: 'kiosk',       label: lang === 'sw' ? 'Kiosk / Duka'        : 'Kiosk / Shop',         emoji: '🏪' },
  { value: 'minimarket',  label: lang === 'sw' ? 'Mini Market'          : 'Mini Market',           emoji: '🛒' },
  { value: 'supermarket', label: lang === 'sw' ? 'Supermarket'          : 'Supermarket',           emoji: '🏬' },
  { value: 'vegetable',   label: lang === 'sw' ? 'Mboga / Mama Mboga'   : 'Vegetable / Grocer',    emoji: '🥬' },
  { value: 'salon',       label: lang === 'sw' ? 'Saloon / Kinyozi'     : 'Salon / Barber',        emoji: '✂️' },
  { value: 'pub',         label: lang === 'sw' ? 'Bar / Pab'            : 'Bar / Pub',             emoji: '🍺' },
  { value: 'hotel',       label: lang === 'sw' ? 'Hotel / Restaurant'   : 'Hotel / Restaurant',    emoji: '🍽️' },
  { value: 'clothing',    label: lang === 'sw' ? 'Nguo / Mitumba'       : 'Clothing / Mitumba',    emoji: '👗' },
  { value: 'shoes',       label: lang === 'sw' ? 'Viatu'                : 'Shoe Store',            emoji: '👟' },
  { value: 'pharmacy',    label: lang === 'sw' ? 'Duka la Dawa'         : 'Pharmacy / Chemist',    emoji: '💊' },
  { value: 'hardware',    label: lang === 'sw' ? 'Hardware / Vifaa'     : 'Hardware / Tools',      emoji: '🔧' },
  { value: 'butchery',    label: lang === 'sw' ? 'Nyama / Butchery'     : 'Butchery / Meat',       emoji: '🥩' },
  { value: 'electronics', label: lang === 'sw' ? 'Elektroniki'          : 'Electronics',           emoji: '📱' },
  { value: 'other',       label: lang === 'sw' ? 'Biashara Nyingine'    : 'Other Business',        emoji: '💼' },
]

type Step = 'language' | 'welcome' | 'shop' | 'mpesa' | 'pin' | 'done'

export const SetupScreen: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState<Step>('language')
  const [lang, setLang] = useState<Lang>('sw')
  const [loading, setLoading] = useState(false)
  const t = T[lang]
  const bizTypes = getBizTypes(lang)

  const [form, setForm] = useState({
    shopName: '',
    businessType: '' as BusinessType,
    phone: '',
    country: 'KE',
    county: '',
    town: '',
    mpesaTill: '',
  })
  const [pinInput, setPinInput] = useState('')
  const [pinConfirmInput, setPinConfirmInput] = useState('')
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create')

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const selectedCountry = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0]

  // ─── STEP: LANGUAGE ───────────────────────────────────────────
  if (step === 'language') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-5xl mb-6">🌍</div>
      <h2 className="text-xl font-bold mb-2 text-center">{t.choose_lang}</h2>
      <div className="w-full max-w-xs space-y-3 mt-6">
        <button
          onClick={() => { setLang('sw'); setStep('welcome') }}
          className="w-full flex items-center gap-4 bg-dark-card border border-dark-border rounded-xl px-5 py-4 active:bg-brand/10 active:border-brand transition-colors"
        >
          <span className="text-3xl">🇰🇪</span>
          <div className="text-left">
            <div className="font-bold text-base">Kiswahili</div>
            <div className="text-xs text-gray-400">Lugha ya Kiswahili</div>
          </div>
        </button>
        <button
          onClick={() => { setLang('en'); setStep('welcome') }}
          className="w-full flex items-center gap-4 bg-dark-card border border-dark-border rounded-xl px-5 py-4 active:bg-brand/10 active:border-brand transition-colors"
        >
          <span className="text-3xl">🇬🇧</span>
          <div className="text-left">
            <div className="font-bold text-base">English</div>
            <div className="text-xs text-gray-400">English Language</div>
          </div>
        </button>
      </div>
    </div>
  )

  // ─── STEP: WELCOME ────────────────────────────────────────────
  if (step === 'welcome') return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🏪</div>
        <h1 className="text-3xl font-bold text-brand mb-2">BIASHARA360</h1>
        <p className="text-gray-400 text-base leading-relaxed">{t.welcome_sub}</p>
      </div>
      <div className="w-full space-y-3 mb-8">
        {[
          { icon: '📵', text: t.feature1 },
          { icon: '💳', text: t.feature2 },
          { icon: '📊', text: t.feature3 },
          { icon: '📦', text: t.feature4 },
        ].map(f => (
          <div key={f.text} className="flex items-center gap-3 bg-dark-card border border-dark-border rounded-xl px-4 py-3 text-left">
            <span className="text-xl">{f.icon}</span>
            <span className="text-sm text-gray-300">{f.text}</span>
          </div>
        ))}
      </div>
      <div className="w-full space-y-3">
        <button className="btn-primary" onClick={() => setStep('shop')}>
          {t.start} <ChevronRight size={18} />
        </button>
        <button
          onClick={() => setStep('language')}
          className="flex items-center justify-center gap-2 w-full text-sm text-gray-500 active:text-gray-300"
        >
          <Globe size={14} /> {lang === 'sw' ? 'Change Language' : 'Badilisha Lugha'}
        </button>
      </div>
      <p className="mt-3 text-xs text-gray-500">{t.trial}</p>
    </div>
  )

  // ─── STEP: SHOP INFO ──────────────────────────────────────────
  if (step === 'shop') return (
    <div className="min-h-screen flex flex-col">
      <div className="p-6 pb-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
        </div>
        <h2 className="text-xl font-bold mt-3">{t.step_shop}</h2>
        <p className="text-gray-400 text-sm">{t.step_shop_sub}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-6 space-y-4">
        {/* Shop Name */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">{t.shop_name}</label>
          <input
            className="input"
            placeholder={t.shop_name_ph}
            value={form.shopName}
            onChange={e => set('shopName', e.target.value)}
            autoFocus
          />
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">{t.phone}</label>
          <input
            className="input"
            placeholder={t.phone_ph}
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
          />
        </div>

        {/* Country */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">{t.country}</label>
          <select
            className="input"
            value={form.country}
            onChange={e => set('country', e.target.value)}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* County — show Kenya counties if KE selected */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">{t.county}</label>
          {form.country === 'KE' ? (
            <select
              className="input"
              value={form.county}
              onChange={e => set('county', e.target.value)}
            >
              <option value="">{lang === 'sw' ? 'Chagua Kaunti...' : 'Select County...'}</option>
              {KENYA_COUNTIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <input
              className="input"
              placeholder={lang === 'sw' ? 'Mfano: Kampala, Lagos, Dar es Salaam' : 'e.g. Kampala, Lagos, Dar es Salaam'}
              value={form.county}
              onChange={e => set('county', e.target.value)}
            />
          )}
        </div>

        {/* Town */}
        <div>
          <label className="text-sm text-gray-400 mb-1.5 block">{t.town}</label>
          <input
            className="input"
            placeholder={t.town_ph}
            value={form.town}
            onChange={e => set('town', e.target.value)}
          />
        </div>

        {/* Business Type */}
        <div>
          <label className="text-sm text-gray-400 mb-2 block">{t.business_type}</label>
          <div className="grid grid-cols-2 gap-2">
            {bizTypes.map(bt => (
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

        <button
          className="btn-primary"
          onClick={() => {
            if (!form.shopName.trim()) { toast.error(t.error_name); return }
            if (!form.phone.trim()) { toast.error(t.error_phone); return }
            if (!form.businessType) { toast.error(t.error_type); return }
            if (!form.country) { toast.error(t.error_country); return }
            if (!form.county.trim()) { toast.error(t.error_county); return }
            if (!form.town.trim()) { toast.error(t.error_town); return }
            setStep('mpesa')
          }}
        >
          {t.continue} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )

  // ─── STEP: MPESA ──────────────────────────────────────────────
  if (step === 'mpesa') return (
    <div className="min-h-screen flex flex-col p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-brand" />
          <div className="w-2 h-2 rounded-full bg-dark-border" />
        </div>
        <h2 className="text-xl font-bold mt-3">{t.step_mpesa}</h2>
        <p className="text-gray-400 text-sm">{t.step_mpesa_sub}</p>
      </div>
      <div className="space-y-4 flex-1">
        <div className="bg-dark-card border border-dark-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-800 flex items-center justify-center text-lg">💳</div>
            <div>
              <div className="font-semibold text-sm">Lipa Na M-Pesa</div>
              <div className="text-xs text-gray-400">STK Push</div>
            </div>
          </div>
          <input
            className="input"
            placeholder={t.till_ph}
            type="tel"
            inputMode="numeric"
            value={form.mpesaTill}
            onChange={e => set('mpesaTill', e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-2">{t.till_hint}</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-xs text-yellow-400 leading-relaxed">💡 {t.mpesa_how}</p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <button className="btn-primary" onClick={() => setStep('pin')}>
          {t.continue} <ChevronRight size={18} />
        </button>
        <button className="btn-secondary" onClick={() => setStep('pin')}>
          {t.skip}
        </button>
      </div>
    </div>
  )

  // ─── STEP: PIN ────────────────────────────────────────────────
  const handlePinKey = (key: string) => {
    if (pinStep === 'create') {
      if (key === '⌫') { setPinInput(p => p.slice(0, -1)); return }
      if (pinInput.length >= 6) return
      const next = pinInput + key
      setPinInput(next)
      if (next.length === 6) setTimeout(() => setPinStep('confirm'), 400)
    } else {
      if (key === '⌫') { setPinConfirmInput(p => p.slice(0, -1)); return }
      if (pinConfirmInput.length >= 6) return
      const next = pinConfirmInput + key
      setPinConfirmInput(next)
      if (next.length === 6 && next !== pinInput) {
        toast.error(t.pin_mismatch)
        setPinInput('')
        setPinConfirmInput('')
        setPinStep('create')
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
        currency: (selectedCountry.currency as 'KES'),
        vatRate: 0,
        createdAt: new Date().toISOString(),
        location: {
          country: form.country,
          county: form.county.trim(),
          town: form.town.trim(),
        },
        language: lang,
      }

      const user: User = {
        id: userId,
        shopId,
        name: lang === 'sw' ? 'Mmiliki' : 'Owner',
        role: 'owner',
        pinHash,
        isActive: true,
        createdAt: new Date().toISOString()
      }

      await saveShop(shop)
      await saveUser(user)
      setStep('done')
    } catch (err) {
      toast.error(lang === 'sw' ? 'Hitilafu imetokea. Jaribu tena.' : 'An error occurred. Try again.')
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
          {pinStep === 'create' ? t.step_pin : t.step_pin_confirm}
        </h2>
        <p className="text-gray-400 text-sm">
          {pinStep === 'create' ? t.pin_sub : t.pin_confirm_sub}
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

      {pinStep === 'confirm' && pinConfirmInput.length === 6 && pinConfirmInput === pinInput && (
        <button className="btn-primary mt-8 w-full max-w-xs" onClick={handleFinish} disabled={loading}>
          {loading ? <div className="spinner" /> : <>{t.finish} <CheckCircle size={18} /></>}
        </button>
      )}
    </div>
  )

  // ─── STEP: DONE ───────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4 animate-bounce">🎉</div>
      <h2 className="text-2xl font-bold text-brand mb-2">{t.done_title}</h2>
      <p className="text-gray-400 mb-2">
        <strong className="text-white">{form.shopName}</strong> {t.done_sub}
      </p>
      <p className="text-sm text-gray-400 mb-1">
        {selectedCountry.flag} {form.county}, {form.town}
      </p>
      <p className="text-sm text-yellow-400 mb-8">🎁 {t.done_trial}</p>
      <button className="btn-primary" onClick={() => navigate('/login', { replace: true })}>
        {t.login_now} <ChevronRight size={18} />
      </button>
    </div>
  )
}
