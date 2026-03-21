import React, { useState, useRef, useCallback } from 'react'
import { Search, QrCode, Plus, Minus, Trash2, X, Smartphone, Banknote, Scissors, CheckCircle, Loader } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, searchProducts, saveSale, checkAndCreateLowStockAlerts } from '@/db/local'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import { initiateMpesaSTK, pollMpesaStatus, generateWhatsAppReceipt, openWhatsAppReceipt, shareReceiptNative, isValidKenyanPhone, formatMpesaPhone } from '@/lib/mpesa'
import { QrScanner } from '@/components/POS/QrScanner'
import type { CartItem, Product, PaymentMethod, Sale, SaleItem } from '@/types'
import { format } from 'date-fns'

type PayStep = 'cart' | 'choose_payment' | 'cash_input' | 'mpesa_waiting' | 'receipt'

export const SellScreen: React.FC = () => {
  const { shop, user } = useAuth()
  const toast = useToast()

  // ─── CART STATE ─────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [discount, setDiscount] = useState(0)

  // ─── PAYMENT STATE ──────────────────────────────
  const [payStep, setPayStep] = useState<PayStep>('cart')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [cashInput, setCashInput] = useState('')
  const [mpesaPhone, setMpesaPhone] = useState(shop?.phone || '')
  const [mpesaStatus, setMpesaStatus] = useState<'idle'|'sending'|'waiting'|'success'|'failed'>('idle')
  const [mpesaCode, setMpesaCode] = useState('')
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  // ─── COMPUTED ───────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.lineTotal, 0)
  const total = Math.max(0, subtotal - discount)
  const cashReceived = parseFloat(cashInput) || 0
  const change = Math.max(0, cashReceived - total)

  // ─── SEARCH ─────────────────────────────────────
  const handleSearch = useCallback((q: string) => {
    setQuery(q)
    clearTimeout(searchTimeout.current)
    if (!q.trim() || !shop) { setResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      const found = await searchProducts(shop.id, q)
      setResults(found)
      setSearching(false)
    }, 200)
  }, [shop])

  const handleBarcode = useCallback(async (code: string) => {
    setShowScanner(false)
    if (!shop) return
    const product = await db.products.where({ shopId: shop.id, barcode: code }).first()
      || await db.products.where({ shopId: shop.id, sku: code }).first()
    if (product) addToCart(product)
    else toast.error(`Bidhaa haijulikani: ${code}`)
  }, [shop, toast])

  // ─── CART OPERATIONS ────────────────────────────
  const addToCart = useCallback((product: Product) => {
    if (product.qtyInStock <= 0) {
      toast.error(`"${product.name}" haina stoki.`)
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        if (existing.qty >= product.qtyInStock) {
          toast.error(`Stoki ya "${product.name}" ni ${product.qtyInStock} tu.`)
          return prev
        }
        return prev.map(i => i.product.id === product.id
          ? { ...i, qty: i.qty + 1, lineTotal: (i.qty + 1) * i.unitPrice }
          : i)
      }
      return [...prev, { product, qty: 1, unitPrice: product.sellingPrice, lineTotal: product.sellingPrice }]
    })
    setQuery('')
    setResults([])
  }, [toast])

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.product.id === productId
        ? { ...i, qty: i.qty + delta, lineTotal: (i.qty + delta) * i.unitPrice }
        : i)
      .filter(i => i.qty > 0))
  }

  const removeItem = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  const clearCart = () => {
    setCart([])
    setDiscount(0)
    setPayStep('cart')
    setMpesaStatus('idle')
    setMpesaCode('')
    setCashInput('')
  }

  // ─── COMPLETE SALE ──────────────────────────────
  const completeSale = async (method: PaymentMethod, mpesaCodeVal?: string) => {
    if (!shop || !user || cart.length === 0) return

    const items: SaleItem[] = cart.map(i => ({
      productId: i.product.id,
      productName: i.product.name,
      qty: i.qty,
      unitPrice: i.unitPrice,
      costAtSale: i.product.costPrice,
      lineTotal: i.lineTotal
    }))

    const sale: Sale = {
      id: crypto.randomUUID(),
      shopId: shop.id,
      cashierId: user.id,
      items,
      totalAmount: subtotal,
      discount,
      netAmount: total,
      paymentMethod: method,
      cashReceived: method === 'cash' ? cashReceived : undefined,
      changeGiven: method === 'cash' ? change : undefined,
      mpesaPhone: method === 'mpesa' ? formatMpesaPhone(mpesaPhone) : undefined,
      mpesaCode: mpesaCodeVal,
      soldAt: new Date().toISOString(),
      isVoid: false,
      synced: false
    }

    await saveSale(sale)
    await checkAndCreateLowStockAlerts(shop.id)
    setCompletedSale(sale)
    setPayStep('receipt')
  }

  // ─── CASH PAYMENT ───────────────────────────────
  const handleCashPay = () => {
    if (cashReceived < total) {
      toast.error(`Pesa haitoshi. Unahitaji KSH ${total.toLocaleString()} au zaidi.`)
      return
    }
    completeSale('cash')
  }

  // ─── MPESA PAYMENT ──────────────────────────────
  const handleMpesaPay = async () => {
    if (!isValidKenyanPhone(mpesaPhone)) {
      toast.error('Nambari ya simu si sahihi. Mfano: 0712345678')
      return
    }
    setMpesaStatus('sending')

    const result = await initiateMpesaSTK({
      phone: mpesaPhone,
      amount: total,
      accountRef: 'BIASHARA360',
      description: `Malipo duka ${shop?.name || ''}`
    })

    if (!result.success) {
      setMpesaStatus('failed')
      toast.error(result.error || 'M-Pesa haikusubiri. Jaribu tena.')
      return
    }

    setMpesaStatus('waiting')
    toast.info('Ombi limetumwa. Mteja aingie PIN yake ya M-Pesa.')

    if (result.checkoutRequestId) {
      await pollMpesaStatus(result.checkoutRequestId, (status, res) => {
        if (status === 'success' && res) {
          setMpesaCode(res.mpesaCode || '')
          setMpesaStatus('success')
          completeSale('mpesa', res.mpesaCode)
        } else if (status === 'failed') {
          setMpesaStatus('failed')
          toast.error('Mteja hakukubali au pesa haikutosha.')
        }
      })
    }
  }

  // ─── SHARE RECEIPT ──────────────────────────────
  const handleShareReceipt = () => {
    if (!completedSale || !shop) return
    const msg = generateWhatsAppReceipt({
      shopName: shop.name,
      items: cart.map(i => ({ name: i.product.name, qty: i.qty, price: i.unitPrice, total: i.lineTotal })),
      total,
      paymentMethod: completedSale.paymentMethod,
      mpesaCode: completedSale.mpesaCode,
      cashReceived: completedSale.cashReceived,
      change: completedSale.changeGiven,
      date: new Date(completedSale.soldAt)
    })
    shareReceiptNative(msg, shop.name)
  }

  // ─── RENDER: RECEIPT ────────────────────────────────────────
  if (payStep === 'receipt' && completedSale) return (
    <div className="page flex flex-col items-center px-4 pt-8">
      <div className="text-5xl mb-3">✅</div>
      <h2 className="text-xl font-bold text-brand mb-1">Mauzo Yamekamilika!</h2>
      <p className="text-gray-400 text-sm mb-6">
        {format(new Date(completedSale.soldAt), 'dd MMM yyyy, HH:mm')}
      </p>

      <div className="w-full bg-dark-card border border-dark-border rounded-2xl p-4 mb-4">
        <div className="space-y-2 mb-3">
          {cart.map(i => (
            <div key={i.product.id} className="flex justify-between text-sm">
              <span className="text-gray-300">{i.product.name} ×{i.qty}</span>
              <span className="font-semibold">KSH {i.lineTotal.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dark-border pt-3 space-y-1">
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Punguzo</span><span>-KSH {discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg">
            <span>Jumla</span>
            <span className="text-brand">KSH {total.toLocaleString()}</span>
          </div>
          {completedSale.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Pesa Iliyolipwa</span>
                <span>KSH {(completedSale.cashReceived || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-yellow-400">
                <span>Chenji</span>
                <span>KSH {(completedSale.changeGiven || 0).toLocaleString()}</span>
              </div>
            </>
          )}
          {completedSale.mpesaCode && (
            <div className="flex justify-between text-sm text-green-400">
              <span>Nambari ya M-Pesa</span>
              <span className="font-mono">{completedSale.mpesaCode}</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-3">
        <button className="btn-secondary" onClick={handleShareReceipt}>
          📱 Shiriki Risiti (WhatsApp / SMS)
        </button>
        <button className="btn-primary" onClick={clearCart}>
          Uuzaji Mpya 🛒
        </button>
      </div>
    </div>
  )

  // ─── RENDER: MPESA WAITING ──────────────────────────────────
  if (payStep === 'mpesa_waiting') return (
    <div className="page flex flex-col items-center justify-center px-6">
      <div className={`text-6xl mb-4 ${mpesaStatus === 'waiting' ? 'animate-pulse' : ''}`}>
        {mpesaStatus === 'success' ? '✅' : mpesaStatus === 'failed' ? '❌' : '📱'}
      </div>
      <h2 className="text-xl font-bold mb-2 text-center">
        {mpesaStatus === 'sending' ? 'Inatuma ombi...'
        : mpesaStatus === 'waiting' ? 'Subiri Mteja...'
        : mpesaStatus === 'success' ? 'Malipo Yamepokewa!'
        : 'Malipo Hayakufanyika'}
      </h2>
      <p className="text-gray-400 text-sm text-center mb-6">
        {mpesaStatus === 'waiting' && `Ombi limetumwa kwa ${mpesaPhone}. Mteja aingie PIN yake ya M-Pesa.`}
        {mpesaStatus === 'failed' && 'Mteja hakukubali au pesa haikutosha. Jaribu tena au chagua malipo ya taslimu.'}
      </p>

      {mpesaStatus === 'waiting' && (
        <div className="flex gap-2 mb-6">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: `${i*0.2}s` }} />
          ))}
        </div>
      )}

      {(mpesaStatus === 'failed') && (
        <div className="w-full space-y-3">
          <button className="btn-primary" onClick={() => { setMpesaStatus('idle'); setPayStep('choose_payment') }}>
            Jaribu Tena
          </button>
          <button className="btn-secondary" onClick={() => setPayStep('cash_input')}>
            Badilisha hadi Taslimu
          </button>
        </div>
      )}
    </div>
  )

  // ─── RENDER: CASH INPUT ─────────────────────────────────────
  if (payStep === 'cash_input') return (
    <div className="page px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPayStep('choose_payment')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold">Malipo ya Taslimu</h2>
      </div>

      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-6">
        <p className="text-sm text-gray-400 mb-1">Kiasi Kinachohitajika</p>
        <p className="text-3xl font-bold text-brand">KSH {total.toLocaleString()}</p>
      </div>

      <div className="mb-4">
        <label className="text-sm text-gray-400 mb-1.5 block">Pesa Iliyolipwa na Mteja</label>
        <input
          className="input text-2xl font-bold text-center"
          type="number"
          inputMode="numeric"
          placeholder="0"
          value={cashInput}
          onChange={e => setCashInput(e.target.value)}
          autoFocus
        />
      </div>

      {/* Quick amount buttons */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {[50, 100, 200, 500, 1000, 2000, 5000, Math.ceil(total / 50) * 50].map(amt => (
          <button
            key={amt}
            onClick={() => setCashInput(amt.toString())}
            className={`py-2 rounded-xl text-sm font-semibold border transition-colors
              ${parseFloat(cashInput) === amt
                ? 'bg-brand text-black border-brand'
                : 'bg-dark-card border-dark-border text-gray-300 active:bg-brand/20'}`}
          >
            {amt.toLocaleString()}
          </button>
        ))}
      </div>

      {cashReceived >= total && (
        <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-3 mb-4 flex justify-between">
          <span className="text-green-400 text-sm">Chenji ya Kurudisha</span>
          <span className="text-green-400 font-bold">KSH {change.toLocaleString()}</span>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={cashReceived < total}
        onClick={handleCashPay}
      >
        <CheckCircle size={18} />
        Kamilisha Malipo
      </button>
    </div>
  )

  // ─── RENDER: CHOOSE PAYMENT ─────────────────────────────────
  if (payStep === 'choose_payment') return (
    <div className="page px-4 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setPayStep('cart')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <div>
          <h2 className="text-lg font-bold">Chagua Njia ya Malipo</h2>
          <p className="text-xs text-gray-400">Jumla: <span className="text-brand font-bold">KSH {total.toLocaleString()}</span></p>
        </div>
      </div>

      <div className="space-y-3">
        {/* M-PESA */}
        <div className="card border-green-700/40">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Smartphone size={18} className="text-green-400" /> Lipa Na M-Pesa
          </h3>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Nambari ya Simu ya Mteja"
              type="tel"
              inputMode="tel"
              value={mpesaPhone}
              onChange={e => setMpesaPhone(e.target.value)}
            />
            <button
              onClick={() => { setPayStep('mpesa_waiting'); handleMpesaPay() }}
              disabled={!isValidKenyanPhone(mpesaPhone) || mpesaStatus === 'sending'}
              className="px-5 py-3 bg-green-700 text-white rounded-xl font-bold text-sm active:bg-green-800 disabled:opacity-50 whitespace-nowrap"
            >
              {mpesaStatus === 'sending' ? <Loader size={16} className="animate-spin" /> : 'Tuma STK'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Ombi litumwe kwenye simu ya mteja. Aingie PIN yake ya M-Pesa.
          </p>
        </div>

        {/* CASH */}
        <button
          className="card w-full text-left flex items-center gap-4 active:bg-dark-surface"
          onClick={() => setPayStep('cash_input')}
        >
          <div className="w-11 h-11 rounded-full bg-yellow-800/50 flex items-center justify-center">
            <Banknote size={20} className="text-yellow-400" />
          </div>
          <div>
            <div className="font-semibold">Taslimu (Pesa Mkononi)</div>
            <div className="text-xs text-gray-400">Hesabu chenji moja kwa moja</div>
          </div>
        </button>

        {/* SPLIT */}
        <button
          className="card w-full text-left flex items-center gap-4 active:bg-dark-surface"
          onClick={() => toast.info('Split payment inakuja hivi karibuni!')}
        >
          <div className="w-11 h-11 rounded-full bg-blue-800/50 flex items-center justify-center">
            <Scissors size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="font-semibold">Gawanya Malipo</div>
            <div className="text-xs text-gray-400">Sehemu M-Pesa, sehemu taslimu</div>
          </div>
        </button>
      </div>
    </div>
  )

  // ─── RENDER: MAIN CART ──────────────────────────────────────
  return (
    <div className="page">
      {/* Search bar */}
      <div className="page-header">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input pl-9 pr-4 py-2.5 text-sm"
              placeholder="Tafuta bidhaa au scan QR..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="w-10 h-10 rounded-xl bg-dark-card border border-dark-border flex items-center justify-center active:bg-dark-surface"
          >
            <QrCode size={18} className="text-brand" />
          </button>
        </div>
      </div>

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div className="mx-4 mb-2 bg-dark-surface border border-dark-border rounded-xl overflow-hidden shadow-2xl">
          {results.slice(0, 6).map(product => (
            <button
              key={product.id}
              className="list-item w-full text-left"
              onClick={() => addToCart(product)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{product.name}</p>
                <p className="text-xs text-gray-400">{product.category} · {product.qtyInStock} {product.unit}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-brand">KSH {product.sellingPrice.toLocaleString()}</p>
                {product.qtyInStock <= product.reorderLevel && (
                  <span className="badge badge-red text-xs">Stoki chini</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty cart state */}
      {cart.length === 0 && !query && (
        <div className="flex flex-col items-center justify-center mt-16 px-6 text-center">
          <div className="text-5xl mb-4">🛒</div>
          <p className="text-gray-400 text-sm">Tafuta bidhaa au scan QR code kuanza uuzaji</p>
          <p className="text-gray-600 text-xs mt-2">Au bonyeza 📷 kuscan bar code</p>
        </div>
      )}

      {/* Cart items */}
      {cart.length > 0 && (
        <div className="px-4 pb-2">
          <div className="space-y-2 mb-4">
            {cart.map(item => (
              <div key={item.product.id} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.product.name}</p>
                  <p className="text-xs text-gray-400">
                    KSH {item.unitPrice.toLocaleString()} × {item.qty} = <span className="text-brand font-semibold">KSH {item.lineTotal.toLocaleString()}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => updateQty(item.product.id, -1)}
                    className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-red-900/30"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-7 text-center font-bold text-sm">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.product.id, 1)}
                    className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-brand/20"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeItem(item.product.id)}
                    className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center ml-1 active:bg-red-900/40"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Order total */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Jumla ya Bidhaa</span>
              <span className="font-semibold">KSH {subtotal.toLocaleString()}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center mb-2 text-green-400">
                <span className="text-sm">Punguzo</span>
                <span className="font-semibold">-KSH {discount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-dark-border pt-2">
              <span className="font-bold text-lg">JUMLA</span>
              <span className="font-bold text-2xl text-brand">KSH {total.toLocaleString()}</span>
            </div>
          </div>

          {/* Discount input */}
          <div className="flex gap-2 mb-4">
            <input
              className="input text-sm flex-1"
              type="number"
              inputMode="numeric"
              placeholder="Punguzo (KSH)"
              value={discount || ''}
              onChange={e => setDiscount(Math.min(subtotal, parseFloat(e.target.value) || 0))}
            />
            <button onClick={clearCart} className="w-12 h-12 rounded-xl bg-dark-card border border-red-800/50 flex items-center justify-center active:bg-red-900/30">
              <Trash2 size={18} className="text-red-400" />
            </button>
          </div>

          {/* PAY BUTTON */}
          <button
            className="btn-primary text-lg py-5 mb-6"
            onClick={() => setPayStep('choose_payment')}
          >
            💳 LIPA SASA — KSH {total.toLocaleString()}
          </button>
        </div>
      )}

      {/* QR Scanner overlay */}
      {showScanner && (
        <QrScanner
          onScan={handleBarcode}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  )
}
