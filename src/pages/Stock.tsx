import React, { useState, useRef } from 'react'
import { Plus, Search, Camera, AlertTriangle, Package, X, Check, Edit3, Trash2, Clock, User } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveProduct, updateStock, generateSKU } from '@/db/local'
import { useAuth } from '@/lib/auth'
import { useToast } from '@/lib/toast'
import type { Product, ProductUnit } from '@/types'
import { QrScanner } from '@/components/POS/QrScanner'

type StockView = 'list' | 'add' | 'edit' | 'adjust' | 'detail'

const UNITS: ProductUnit[] = ['piece','kg','g','litre','ml','dozen','carton','pack','pair','metre','service']
const UNIT_LABELS: Record<ProductUnit, string> = {
  piece:'Piece/Kipande', kg:'Kilo (kg)', g:'Grams (g)', litre:'Litre',
  ml:'Millilitre (ml)', dozen:'Dozen (12)', carton:'Carton', pack:'Pack/Paketi',
  pair:'Pair/Jozi', metre:'Metre', service:'Service/Huduma'
}
const CATEGORIES = ['Food/Chakula','Drinks/Vinywaji','Beauty/Vipodozi','Clothing/Nguo','Shoes/Viatu','Medicine/Dawa','Hardware/Vifaa','Electronics','Stationery','Other/Nyingine']

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-KE', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

export const StockScreen: React.FC = () => {
  const { shop, user } = useAuth()
  const toast = useToast()
  const [view, setView] = useState<StockView>('list')
  const [query, setQuery] = useState('')
  const [filterLow, setFilterLow] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const imgRef = useRef<HTMLInputElement>(null)

  // ─── LIVE QUERIES ────────────────────────────────────────────
  const products = useLiveQuery(async () => {
    if (!shop) return []
    let all = await db.products
      .where({ shopId: shop.id, isActive: 1 as unknown as boolean })
      .sortBy('name')
    if (filterLow) all = all.filter(p => p.qtyInStock <= p.reorderLevel)
    if (query) {
      const q = query.toLowerCase()
      all = all.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      )
    }
    return all
  }, [shop?.id, query, filterLow], [])

  const lowCount = useLiveQuery(async () => {
    if (!shop) return 0
    return db.products
      .where('shopId').equals(shop.id)
      .and(p => p.isActive && p.qtyInStock <= p.reorderLevel)
      .count()
  }, [shop?.id], 0)

  const totalProducts = useLiveQuery(async () => {
    if (!shop) return 0
    return db.products.where({ shopId: shop.id, isActive: 1 as unknown as boolean }).count()
  }, [shop?.id], 0)

  // ─── FORM STATE ──────────────────────────────────────────────
  const emptyForm = (): Partial<Product> => ({
    name: '', category: 'Food/Chakula', costPrice: 0, sellingPrice: 0,
    unit: 'piece', qtyInStock: 0, reorderLevel: 5,
    imageUrl: undefined, barcode: undefined
  })
  const [form, setForm] = useState<Partial<Product>>(emptyForm())
  const [imgPreview, setImgPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k: keyof Product, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [adjustSign, setAdjustSign] = useState('+')

  // ─── HANDLERS ────────────────────────────────────────────────
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
    if (!shop || !form.name?.trim()) { toast.error('Enter product name.'); return }
    if ((form.sellingPrice || 0) <= 0) { toast.error('Enter selling price.'); return }
    setSaving(true)
    try {
      const isEdit = view === 'edit' && selectedProduct
      const now = new Date().toISOString()
      const product: Product = {
        id: isEdit ? selectedProduct!.id : crypto.randomUUID(),
        shopId: shop.id,
        name: form.name!.trim(),
        sku: isEdit ? selectedProduct!.sku : generateSKU(form.name!),
        barcode: form.barcode || undefined,
        category: form.category || 'Food/Chakula',
        costPrice: form.costPrice || 0,
        sellingPrice: form.sellingPrice!,
        unit: form.unit || 'piece',
        qtyInStock: form.qtyInStock || 0,
        reorderLevel: form.reorderLevel || 5,
        expiryDate: form.expiryDate,
        imageUrl: form.imageUrl,
        isActive: true,
        updatedAt: now,
        synced: false,
        // Store creator info in a metadata field
        ...(isEdit ? {} : {
          createdAt: now,
          createdBy: user?.name || 'Owner',
        } as unknown as Product),
      }
      await saveProduct(product)
      toast.success(isEdit ? `"${product.name}" updated.` : `"${product.name}" added!`)
      setForm(emptyForm())
      setImgPreview('')
      setView('list')
    } catch {
      toast.error('Error saving. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (productId: string, productName: string) => {
    if (deleteConfirm !== productId) {
      setDeleteConfirm(productId)
      toast.info(`Tap delete again to confirm removing "${productName}"`)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    await db.products.where('id').equals(productId).modify({ isActive: false, updatedAt: new Date().toISOString() })
    toast.success(`"${productName}" removed from stock.`)
    setDeleteConfirm(null)
    if (view === 'detail') setView('list')
  }

  const handleEditOpen = (p: Product) => {
    setSelectedProduct(p)
    setForm({ ...p })
    setImgPreview(p.imageUrl || '')
    setView('edit')
  }

  const handleDetailOpen = (p: Product) => {
    setSelectedProduct(p)
    setView('detail')
  }

  const handleAdjust = async () => {
    if (!selectedProduct) return
    const val = parseFloat(adjustQty)
    if (isNaN(val) || val <= 0) { toast.error('Enter a valid quantity.'); return }
    const delta = adjustSign === '+' ? val : -val
    await updateStock(selectedProduct.id, delta)
    toast.success(`Stock for "${selectedProduct.name}" updated.`)
    setAdjustQty('')
    setAdjustNote('')
    setView('list')
  }

  const handleBarcodeScan = (code: string) => {
    setShowScanner(false)
    set('barcode', code)
    toast.info(`Barcode: ${code}`)
  }

  // ─── ADD / EDIT FORM ─────────────────────────────────────────
  if (view === 'add' || view === 'edit') return (
    <div className="page">
      <div className="page-header">
        <button onClick={() => setView('list')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <h1 className="page-title">{view === 'add' ? '+ Add Product' : 'Edit Product'}</h1>
        <button onClick={handleSave} disabled={saving} className="text-brand font-bold">
          {saving ? '...' : <Check size={20} />}
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div
            onClick={() => imgRef.current?.click()}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-dark-border bg-dark-card flex flex-col items-center justify-center cursor-pointer overflow-hidden active:border-brand"
          >
            {imgPreview
              ? <img src={imgPreview} alt="" className="w-full h-full object-cover" />
              : <><Camera size={22} className="text-gray-500 mb-1" /><span className="text-xs text-gray-500">Photo</span></>
            }
          </div>
          <input ref={imgRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          <div className="flex-1">
            <p className="text-sm text-gray-400 mb-1">Product photo (optional)</p>
            <button onClick={() => imgRef.current?.click()} className="btn-secondary py-2 text-xs">
              <Camera size={14} /> Take Photo
            </button>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Product Name *</label>
          <input className="input" placeholder="e.g. Sugar 1kg" value={form.name || ''} onChange={e => set('name', e.target.value)} autoFocus={view === 'add'} />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Cost Price (KSH)</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.costPrice || ''} onChange={e => set('costPrice', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Selling Price (KSH) *</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.sellingPrice || ''} onChange={e => set('sellingPrice', parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        {/* Margin */}
        {(form.costPrice || 0) > 0 && (form.sellingPrice || 0) > 0 && (
          <div className={`text-xs px-3 py-2 rounded-lg ${form.sellingPrice! > form.costPrice! ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {form.sellingPrice! > form.costPrice!
              ? `✅ Profit: KSH ${(form.sellingPrice! - form.costPrice!).toFixed(2)} (${(((form.sellingPrice! - form.costPrice!) / form.costPrice!) * 100).toFixed(0)}%)`
              : `⚠️ Selling price is below cost!`}
          </div>
        )}

        {/* Qty & Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Stock Quantity</label>
            <input className="input" type="number" inputMode="decimal" placeholder="0" value={form.qtyInStock || ''} onChange={e => set('qtyInStock', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Unit</label>
            <select className="input" value={form.unit || 'piece'} onChange={e => set('unit', e.target.value as ProductUnit)}>
              {UNITS.map(u => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
            </select>
          </div>
        </div>

        {/* Category + Reorder */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Category</label>
            <select className="input" value={form.category || 'Food/Chakula'} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Reorder Alert Level</label>
            <input className="input" type="number" inputMode="numeric" placeholder="5" value={form.reorderLevel || ''} onChange={e => set('reorderLevel', parseFloat(e.target.value) || 5)} />
          </div>
        </div>

        {/* Barcode */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Barcode / QR Code (optional)</label>
          <div className="flex gap-2">
            <input className="input flex-1 font-mono text-sm" placeholder="Scan or type barcode" value={form.barcode || ''} onChange={e => set('barcode', e.target.value)} />
            <button onClick={() => setShowScanner(true)} className="w-12 h-12 rounded-xl bg-dark-card border border-dark-border flex items-center justify-center">
              <Search size={16} className="text-brand" />
            </button>
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Expiry Date (optional)</label>
          <input className="input" type="date" value={form.expiryDate || ''} onChange={e => set('expiryDate', e.target.value)} />
        </div>

        <button className="btn-primary mb-4" onClick={handleSave} disabled={saving}>
          {saving ? <div className="spinner" /> : <><Check size={18} /> {view === 'add' ? 'Save Product' : 'Update Product'}</>}
        </button>

        {/* Delete button in edit mode */}
        {view === 'edit' && selectedProduct && (
          <button
            className="btn-danger mb-8"
            onClick={() => handleDelete(selectedProduct.id, selectedProduct.name)}
          >
            <Trash2 size={16} />
            {deleteConfirm === selectedProduct.id ? 'Tap again to confirm delete' : 'Delete Product'}
          </button>
        )}
      </div>
      {showScanner && <QrScanner onScan={handleBarcodeScan} onClose={() => setShowScanner(false)} />}
    </div>
  )

  // ─── PRODUCT DETAIL VIEW ─────────────────────────────────────
  if (view === 'detail' && selectedProduct) return (
    <div className="page">
      <div className="page-header">
        <button onClick={() => setView('list')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="page-title truncate">{selectedProduct.name}</h1>
        <button onClick={() => handleEditOpen(selectedProduct)} className="text-brand">
          <Edit3 size={18} />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Image */}
        {selectedProduct.imageUrl && (
          <img src={selectedProduct.imageUrl} alt="" className="w-full h-48 object-cover rounded-xl" />
        )}

        {/* Key info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">In Stock</p>
            <p className={`text-2xl font-bold ${selectedProduct.qtyInStock <= selectedProduct.reorderLevel ? 'text-red-400' : 'text-brand'}`}>
              {selectedProduct.qtyInStock}
            </p>
            <p className="text-xs text-gray-500">{selectedProduct.unit}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-400 mb-1">Selling Price</p>
            <p className="text-2xl font-bold text-brand">KSH {selectedProduct.sellingPrice.toLocaleString()}</p>
            <p className="text-xs text-gray-500">per {selectedProduct.unit}</p>
          </div>
        </div>

        {/* Details */}
        <div className="card space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Category</span>
            <span>{selectedProduct.category}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Cost Price</span>
            <span>KSH {selectedProduct.costPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Profit Margin</span>
            <span className="text-green-400">
              {selectedProduct.costPrice > 0
                ? `${(((selectedProduct.sellingPrice - selectedProduct.costPrice) / selectedProduct.costPrice) * 100).toFixed(0)}%`
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Reorder Level</span>
            <span>{selectedProduct.reorderLevel} {selectedProduct.unit}</span>
          </div>
          {selectedProduct.barcode && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Barcode</span>
              <span className="font-mono text-xs">{selectedProduct.barcode}</span>
            </div>
          )}
          {selectedProduct.expiryDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Expiry Date</span>
              <span className={new Date(selectedProduct.expiryDate) < new Date() ? 'text-red-400' : 'text-yellow-400'}>
                {selectedProduct.expiryDate}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">SKU</span>
            <span className="font-mono text-xs">{selectedProduct.sku}</span>
          </div>
        </div>

        {/* Timestamps */}
        <div className="card space-y-3">
          <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
            <Clock size={14} /> History
          </h3>
          {(selectedProduct as any).createdAt && (
            <div className="flex items-start gap-2 text-xs">
              <User size={12} className="text-brand mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-400">Created by</p>
                <p className="text-white">{(selectedProduct as any).createdBy || 'Owner'}</p>
                <p className="text-gray-500">{fmtDate((selectedProduct as any).createdAt)}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 text-xs">
            <Clock size={12} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-400">Last updated</p>
              <p className="text-gray-500">{fmtDate(selectedProduct.updatedAt)}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setAdjustQty(''); setAdjustSign('+'); setView('adjust') }}
            className="btn-secondary"
          >
            <Plus size={16} /> Adjust Stock
          </button>
          <button onClick={() => handleEditOpen(selectedProduct)} className="btn-secondary">
            <Edit3 size={16} /> Edit
          </button>
        </div>

        <button
          className="btn-danger mb-8"
          onClick={() => handleDelete(selectedProduct.id, selectedProduct.name)}
        >
          <Trash2 size={16} />
          {deleteConfirm === selectedProduct.id ? 'Tap again to confirm' : 'Delete Product'}
        </button>
      </div>
    </div>
  )

  // ─── ADJUST STOCK ─────────────────────────────────────────────
  if (view === 'adjust' && selectedProduct) return (
    <div className="page px-4 pt-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setView(view === 'adjust' ? 'list' : 'detail')} className="w-9 h-9 rounded-full bg-dark-card flex items-center justify-center">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold">Adjust Stock</h2>
      </div>

      <div className="card mb-4">
        <div className="flex items-center gap-3">
          {selectedProduct.imageUrl
            ? <img src={selectedProduct.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
            : <div className="w-12 h-12 rounded-lg bg-dark-surface flex items-center justify-center"><Package size={20} className="text-gray-500" /></div>
          }
          <div>
            <p className="font-semibold">{selectedProduct.name}</p>
            <p className="text-sm text-brand">{selectedProduct.qtyInStock} {selectedProduct.unit} currently</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Adjustment Type</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => setAdjustSign('+')}
              className={`py-3 rounded-xl font-bold border transition-colors ${adjustSign === '+' ? 'bg-green-700 border-green-500 text-white' : 'bg-dark-card border-dark-border text-gray-400'}`}
            >
              + Received Stock
            </button>
            <button
              onClick={() => setAdjustSign('-')}
              className={`py-3 rounded-xl font-bold border transition-colors ${adjustSign === '-' ? 'bg-red-800 border-red-600 text-white' : 'bg-dark-card border-dark-border text-gray-400'}`}
            >
              − Remove Stock
            </button>
          </div>
          <input
            className="input text-xl font-bold text-center"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={adjustQty}
            onChange={e => setAdjustQty(e.target.value)}
          />
          {adjustQty && (
            <p className="text-xs text-center mt-2 text-gray-400">
              Stock will become:{' '}
              <strong className="text-brand">
                {Math.max(0, selectedProduct.qtyInStock + (adjustSign === '+' ? 1 : -1) * parseFloat(adjustQty || '0'))} {selectedProduct.unit}
              </strong>
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-1 block">Reason (optional)</label>
          <input className="input" placeholder="e.g. Received from Twiga Foods" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={handleAdjust}>
          <Check size={18} /> Save Adjustment
        </button>
      </div>
    </div>
  )

  // ─── LIST ─────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Stock</h1>
          <p className="text-xs text-gray-500">{totalProducts} products</p>
        </div>
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
          <input className="input pl-9 text-sm" placeholder="Search products..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        {lowCount! > 0 && (
          <button
            onClick={() => setFilterLow(f => !f)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors
              ${filterLow ? 'bg-red-900/30 border-red-700 text-red-400' : 'bg-dark-card border-dark-border text-gray-400'}`}
          >
            <AlertTriangle size={14} />
            {filterLow ? 'Show All' : `Low Stock Alert (${lowCount})`}
          </button>
        )}

        {products?.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-400 text-sm">No products yet.</p>
            <p className="text-gray-600 text-xs mt-1">Tap + to add your first product.</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {products?.map(product => {
              const isLow = product.qtyInStock <= product.reorderLevel
              const margin = product.costPrice > 0
                ? ((product.sellingPrice - product.costPrice) / product.costPrice * 100).toFixed(0)
                : null
              return (
                <div
                  key={product.id}
                  className="card flex items-center gap-3 active:bg-dark-surface cursor-pointer"
                  onClick={() => handleDetailOpen(product)}
                >
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
                      {isLow && <span className="badge badge-red">⚠ Low</span>}
                      {margin && <span className="badge badge-green">{margin}% profit</span>}
                    </div>
                    {/* Timestamp */}
                    <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      Updated {fmtDate(product.updatedAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-brand">KSH {product.sellingPrice.toLocaleString()}</p>
                    <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setSelectedProduct(product); setAdjustQty(''); setAdjustSign('+'); setView('adjust') }}
                        className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-brand/20"
                        title="Adjust stock"
                      >
                        <Plus size={13} className="text-brand" />
                      </button>
                      <button
                        onClick={() => handleEditOpen(product)}
                        className="w-8 h-8 rounded-lg bg-dark-surface border border-dark-border flex items-center justify-center active:bg-dark-card"
                        title="Edit"
                      >
                        <Edit3 size={13} className="text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id, product.name)}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center active:bg-red-900/40
                          ${deleteConfirm === product.id ? 'bg-red-900/40 border-red-600' : 'bg-dark-surface border-dark-border'}`}
                        title="Delete"
                      >
                        <Trash2 size={13} className={deleteConfirm === product.id ? 'text-red-400' : 'text-gray-500'} />
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

// Missing import
function ArrowLeft({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  )
}
