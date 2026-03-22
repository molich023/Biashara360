import React, { useState, useRef } from 'react'
import { Plus, Search, Camera, AlertTriangle, Package, X, Check, Edit3 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveProduct, updateStock, generateSKU } from '@/db/local'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { Product, ProductUnit } from '@/types'
import { QrScanner } from '@/components/POS/QrScanner'

type StockView = 'list' | 'add' | 'edit' | 'adjust'

const UNITS: ProductUnit[] = ['piece','kg','g','litre','ml','dozen','carton','pack','pair','metre','service']
const UNIT_LABELS: Record<ProductUnit, string> = {
  piece:'Kipande', kg:'Kilo (kg)', g:'Gramu (g)', litre:'Lita', ml:'Milimita (ml)',
  dozen:'Dazeni (12)', carton:'Kartoni', pack:'Paketi', pair:'Jozi', metre:'Mita', service:'Huduma'
}

const CATEGORIES = ['Chakula','Vinywaji','Vipodozi','Nguo','Viatu','Dawa','Vifaa vya Nyumba','Elektroniki','Vitu vya Shule','Nyingine']

export const StockScreen: React.FC = () => {
  const { shop } = useAuth()
  const toast = useToast()
  const [view, setView] = useState<StockView>('list')
  const [query, setQuery] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)

  const products = useLiveQuery(async () => {
    if (!shop) return []
    let all = await db.products.where({ shopId: shop.id, isActive: 1 as unknown as boolean }).sortBy('name')
    if (filterLow) all = all.filter(p => p.qtyInStock <= p.reorderLevel)
    if (query) {
      const q = query.toLowerCase()
      all = all.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }
    return all
  }, [shop?.id, query, filterLow], [])

  const lowCount = useLiveQuery(async () => {
    if (!shop) return 0
    return db.products.where('shopId').equals(shop.id).and(p => p.isActive && p.qtyInStock <= p.reorderLevel).count()
  }, [shop?.id], 0)

  const emptyForm = (): Partial<Product> => ({
    name: '', category: 'Chakula', costPrice: 0, sellingPrice: 0,
    unit: 'piece', qtyInStock: 0, reorderLevel: 5, imageUrl: undefined, barcode: undefined
  })
  const [form, setForm] = useState<Partial<Product>>(emptyForm())
  const [imgPreview, setImgPreview] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Product, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const url = ev.target?.result as string
      setImgPreview(url)
      set('imageUrl', url)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!shop || !form.name?.trim()) { toast.error('Weka jina la bidhaa.'); return }
    if ((form.sellingPrice || 0) <= 0) { toast.error('Weka bei ya uuzaji.'); return }
    setSaving(true)
    try {
      const isEdit = view === 'edit' && selectedProduct
      const product: Product = {
        id: isEdit ? selectedProduct!.id : crypto.randomUUID(),
        shopId: shop.id,
        name: form.name!.trim(),
        sku: isEdit ? selectedProduct!.sku : generateSKU(form.name!),
        barcode: form.barcode || undefined,
        category: form.category || 'Chakula',
        costPrice: form.costPrice || 0,
        sellingPrice: form.sellingPrice!,
        unit: form.unit || 'piece',
        qtyInStock: form.qtyInStock || 0,
        reorderLevel: form.reorderLevel || 5,
        expiryDate: form.expiryDate,
        imageUrl: form.imageUrl,
        isActive: true,
        updatedAt: new Date().toISOString(),
        synced: false
      }
      await saveProduct(product)
      toast.success(isEdit ? `"${product.name}" imesasishwa.` : `"${product.name}" imeongezwa!`)
      setForm(emptyForm())
      setImgPreview('')
      setView('list')
    } catch {
      toast.error('Hitilafu. Jaribu tena.')
    } finally {
      setSaving(false)
    }
  }

  const handleEditOpen = (p: Product) => {
    setSelectedProduct(p)
    setForm({ ...p })
    setImgPreview(p.imageUrl || '')
    setView('edit')
  }

  const handleAdjust = async () => {
    if (!selectedProduct) return
    const delta = parseFloat(adjustQty)
    if (isNaN(delta) || delta === 0) { toast.error('Weka kiasi sahihi.'); return }
    await updateStock(selectedProduct.id, delta)
    toast.success(`Stoki ya "${selectedProduct.name}" imesasishwa.`)
    setAdjustQty('')
    setAdjustNote('')
    setView('list')
  }

  const handleBarcodeScan = (code: string) => {
    setShowScanner(false)
    set('barcode', code)
    toast.info(`Barcode: ${code}`)
  }

  const toggleAdjustSign = () => {
    setAdjustQty(q => q.startsWith('-') ? q.slice(1) : q ? '-' + q : '')
  }

  const handleAdjustInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const signed = adjustQty.startsWith('-') ? '-' + val : val
    setAdjustQty(signed)
  }

  // ─── ADD / EDIT FORM ──────────────────────────────────────────
  if (view === 'add' || view === 'edit') return (
    <div className="page">
      <div className="page-header">
        <button onClick={() => setView('list')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <h1 className="page-title">{view === 'add' ? '+ Bidhaa Mpya' : 'Hariri Bidhaa'}</h1>
        <button onClick={handleSave} disabled={saving} className="text-brand font-bold text-sm">
          {saving ? '...' : <Check size={20} />}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center gap-4">
          <div
            onClick={() => imgRef.current?.click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-dark-border bg-dark-card flex flex-col items-center justify-center cursor-pointer overflow-hidden active:border-brand"
          >
            {imgPreview
              ? <img src={imgPreview} alt="" className="w-full h-full object-cover" />
              : <><Camera size={22} className="text-gray-500 mb-1" /><span className="text-xs text-gray-500">Picha</span></>
            }
          </div>
          <input ref={imgRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <div className="flex-1">
            <p className="text-sm text-gray-400 mb-1">Picha ya bidhaa (si lazima)</p>
            <button onClick={() => imgRef.current?.click()} className="btn-secondary py-2 text-xs">
              <Camera size={14} /> Piga Picha
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Jina la Bidhaa *</label>
          <input className="input" placeholder="Mfano: Sukari 1kg" value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus={view === 'add'} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Bei ya Kununua (KSH)</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.costPrice || ''} onChange={e => set('costPrice', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Bei ya Kuuza (KSH) *</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.sellingPrice || ''} onChange={e => set('sellingPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {(form.costPrice || 0) > 0 && (form.sellingPrice || 0) > 0 && (
          <div className={`text-xs px-3 py-2 rounded-lg ${form.sellingPrice! > form.costPrice! ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {form.sellingPrice! > form.costPrice!
              ? `✅ Faida: KSH ${(form.sellingPrice! - form.costPrice!).toFixed(2)} (${(((form.sellingPrice! - form.costPrice!) / form.costPrice!) * 100).toFixed(0)}%)`
              : `⚠️ Bei ya uuzaji ni ndogo kuliko gharama!`
            }
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Idadi ya Stoki</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.qtyInStock || ''} onChange={e => set('qtyInStock', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Kipimo</label>
            <select className="input" value={form.unit || 'piece'} onChange={e => set('unit', e.target.value as ProductUnit)}>
              {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Aina ya Bidhaa</label>
            <select className="input" value={form.category || 'Chakula'} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Kiwango cha Onyo</label>
            <input className="input" type="number" inputMode="numeric" placeholder="5" value={form.reorderLevel || ''} onChange={e => set('reorderLevel', parseFloat(e.target.value) || 5)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Barcode / QR Code (si lazima)</label>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono text-sm" placeholder="Scan au andika barcode" value={form.barcode || ''} onChange={e => set('barcode', e.target.value)} />
            <button onClick={() => setShowScanner(true)} className="w-12 h-12 rounded-xl bg-dark-card border border-dark-border flex items-center justify-center">
              <Search size={16} className="text-brand" />
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400 mb-1 block">Tarehe ya Kuisha Muda (si lazima)</label>
          <input className="input" type="date" value={form.expiryDate || ''} onChange={e => set('expiryDate', e.target.value)} />
        </div>

        <button className="btn-primary mb-8" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" /> : <><Check size={18} /> {view === 'add' ? 'Hifadhi Bidhaa' : 'Sasisha Bidhaa'}</>}
        </button>
      </div>

      {showScanner && <QrScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
    </div>
  )

  // ─── ADJUST STOCK ─────────────────────────────────────────────
  if (view === 'adjust' && selectedProduct) return (
    <div className="page px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView('list')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold">Rekebisha Stoki</h2>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-3">
          {selectedProduct.imageUrl
            ? <img src={selectedProduct.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
            : <div className="w-12 h-12 rounded-lg bg-dark-surface flex items-center justify-center"><Package size={20} className="text-gray-500" /></div>
          }
          <div>
            <p className="font-semibold">{selectedProduct.name}</p>
            <p className="text-sm text-brand">{selectedProduct.qtyInStock} {selectedProduct.unit} sasa hivi</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Badiliko la Stoki</label>
          <div className="flex gap-2">
            <button
              onClick={toggleAdjustSign}
              className={`px-4 h-12 rounded-xl border font-bold ${adjustQty.startsWith('-') ? 'border-red-500 bg-red-900/30 text-red-400' : 'border-green-500 bg-green-900/30 text-green-400'}`}
            >
              {adjustQty.startsWith('-') ? '−' : '+'}
            </button>
            <input
              className="input flex-1 text-xl font-bold text-center"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={adjustQty.replace('-', '')}
              onChange={handleAdjustInput}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Tumia (+) kupokea stoki, (−) kuondoa</p>
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Sababu (si lazima)</label>
          <input className="input" placeholder="Mfano: Nilipokea kutoka Twiga Foods" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={handleAdjust}>
          <Check size={18} /> Hifadhi Mabadiliko
        </button>
      </div>
    </div>
  )

  // ─── LIST ──────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📦 Stoki</h1>
        <button
          onClick={() => { setForm(emptyForm()); setImgPreview(''); setView('add') }}
          className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center active:bg-brand-dark"
        >
          <Plus size={20} className="text-black" />
        </button>
      </div>

      <div className="px-4 pt-3 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input className="input pl-9 text-sm" placeholder="Tafuta bidhaa..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {lowCount! > 0 && (
          <button
            onClick={() => setFilterLow(f => !f)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors
              ${filterLow ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-dark-card border-dark-border text-gray-400'}`}
          >
            <AlertTriangle size={14} />
            {filterLow ? 'Onyesha Zote' : `Stoki Chini (${lowCount})`}
          </button>
        )}

        {products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-400 text-sm">Bado hujaweka bidhaa.</p>
            <p className="text-gray-600 text-xs mt-1">Bonyeza + kuongeza bidhaa ya kwanza.</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {products?.map(product => {
              const isLow = product.qtyInStock <= product.reorderLevel
              const margin = product.costPrice > 0
                ? ((product.sellingPrice - product.costPrice) / product.costPrice * 100).toFixed(0)
                : null
              return (
                <div key={product.id} className="card flex items-center gap-3">
                  {product.imageUrl
                    ? <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-12 h-12 rounded-lg bg-dark-surface flex items-center justify-center flex-shrink-0"><Package size={18} className="text-gray-500" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-400">{product.category}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-semibold ${isLow ? 'text-red-400' : 'text-brand'}`}>
                        {product.qtyInStock} {product.unit}
                      </span>
                      {isLow && <span className="badge badge-red">⚠ Chini</span>}
                      {margin && <span className="badge badge-green">{margin}% faida</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-brand">KSH {product.sellingPrice.toLocaleString()}</p>
                    <div className="flex gap-1 mt-1">
                      <button
                        onClick={() => { setSelectedProduct(product); setAdjustQty(''); setView('adjust') }}
                        className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-brand/20"
                      >
                        <Plus size={13} className="text-brand" />
                      </button>
                      <button
                        onClick={() => handleEditOpen(product)}
                        className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-dark-card"
                      >
                        <Edit3 size={13} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
