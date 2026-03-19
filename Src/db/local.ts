import Dexie, { type Table } from 'dexie'
import type { Shop, User, Product, Sale, Alert, SyncQueueItem } from '@/types'

// ─── DATABASE DEFINITION ──────────────────────────────────────
// This is the heart of BIASHARA360's offline-first architecture.
// ALL data is stored locally first. Network is just for sync.

export class BiasharaDB extends Dexie {
  shops!: Table<Shop>
  users!: Table<User>
  products!: Table<Product>
  sales!: Table<Sale>
  alerts!: Table<Alert>
  syncQueue!: Table<SyncQueueItem>

  constructor() {
    super('biashara360')

    this.version(1).stores({
      // Index the most queried fields for fast lookups
      shops:     'id, phone',
      users:     'id, shopId, role',
      products:  'id, shopId, sku, barcode, category, isActive, qtyInStock, updatedAt, synced',
      sales:     'id, shopId, cashierId, soldAt, paymentMethod, isVoid, synced',
      alerts:    'id, shopId, type, isRead, createdAt',
      syncQueue: 'id, type, createdAt, attempts'
    })
  }
}

export const db = new BiasharaDB()

// ─── SHOP HELPERS ─────────────────────────────────────────────
export const getShop = async (): Promise<Shop | undefined> => {
  return db.shops.toCollection().first()
}

export const saveShop = async (shop: Shop): Promise<void> => {
  await db.shops.put(shop)
}

// ─── USER / AUTH HELPERS ──────────────────────────────────────
export const getOwner = async (shopId: string): Promise<User | undefined> => {
  return db.users.where({ shopId, role: 'owner' }).first()
}

export const saveUser = async (user: User): Promise<void> => {
  await db.users.put(user)
}

// ─── PRODUCT HELPERS ──────────────────────────────────────────
export const getProducts = async (shopId: string): Promise<Product[]> => {
  return db.products
    .where({ shopId, isActive: 1 as unknown as boolean })
    .toArray()
}

export const getProductByBarcode = async (
  shopId: string,
  barcode: string
): Promise<Product | undefined> => {
  return db.products.where({ shopId, barcode }).first()
}

export const searchProducts = async (
  shopId: string,
  query: string
): Promise<Product[]> => {
  const q = query.toLowerCase()
  const all = await db.products
    .where('shopId').equals(shopId)
    .and(p => p.isActive)
    .toArray()
  return all.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.sku.toLowerCase().includes(q) ||
    (p.barcode || '').includes(q)
  )
}

export const saveProduct = async (product: Product): Promise<void> => {
  await db.products.put(product)
  // Queue for server sync
  await addToSyncQueue('product', product)
}

export const updateStock = async (
  productId: string,
  qtyChange: number
): Promise<void> => {
  await db.products
    .where('id').equals(productId)
    .modify(p => {
      p.qtyInStock = Math.max(0, p.qtyInStock + qtyChange)
      p.updatedAt = new Date().toISOString()
      p.synced = false
    })
}

export const getLowStockProducts = async (shopId: string): Promise<Product[]> => {
  const products = await db.products
    .where('shopId').equals(shopId)
    .and(p => p.isActive && p.qtyInStock <= p.reorderLevel)
    .toArray()
  return products
}

// ─── SALE HELPERS ─────────────────────────────────────────────
export const saveSale = async (sale: Sale): Promise<void> => {
  await db.transaction('rw', db.sales, db.products, db.syncQueue, async () => {
    // 1. Save the sale record
    await db.sales.put(sale)

    // 2. Deduct stock for each item
    for (const item of sale.items) {
      await db.products
        .where('id').equals(item.productId)
        .modify(p => {
          p.qtyInStock = Math.max(0, p.qtyInStock - item.qty)
          p.updatedAt = new Date().toISOString()
          p.synced = false
        })
    }

    // 3. Queue sale for server sync
    await db.syncQueue.put({
      id: crypto.randomUUID(),
      type: 'sale',
      payload: sale,
      attempts: 0,
      createdAt: new Date().toISOString()
    })
  })
}

export const getSalesToday = async (shopId: string): Promise<Sale[]> => {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  return db.sales
    .where('soldAt')
    .between(todayStart.toISOString(), todayEnd.toISOString())
    .and(s => s.shopId === shopId && !s.isVoid)
    .toArray()
}

export const getSalesByDateRange = async (
  shopId: string,
  from: Date,
  to: Date
): Promise<Sale[]> => {
  return db.sales
    .where('soldAt')
    .between(from.toISOString(), to.toISOString())
    .and(s => s.shopId === shopId && !s.isVoid)
    .toArray()
}

// ─── DAILY REPORT CALCULATOR ──────────────────────────────────
export const calculateDailyReport = async (shopId: string) => {
  const sales = await getSalesToday(shopId)
  const allProducts = await db.products.where('shopId').equals(shopId).toArray()
  const productMap = new Map(allProducts.map(p => [p.id, p]))

  let totalSales = 0, totalCost = 0, cashSales = 0, mpesaSales = 0
  const productSales = new Map<string, { name: string; qty: number; revenue: number; profit: number }>()
  const hourlySales = Array.from({ length: 24 }, (_, i) => ({ hour: i, amount: 0, count: 0 }))

  for (const sale of sales) {
    totalSales += sale.netAmount
    if (sale.paymentMethod === 'cash') cashSales += sale.netAmount
    else if (sale.paymentMethod === 'mpesa') mpesaSales += sale.netAmount
    else if (sale.paymentMethod === 'split') {
      mpesaSales += sale.mpesaAmount || 0
      cashSales += sale.netAmount - (sale.mpesaAmount || 0)
    }

    const hour = new Date(sale.soldAt).getHours()
    hourlySales[hour].amount += sale.netAmount
    hourlySales[hour].count += 1

    for (const item of sale.items) {
      totalCost += item.costAtSale * item.qty
      const existing = productSales.get(item.productId)
      const itemProfit = (item.unitPrice - item.costAtSale) * item.qty
      if (existing) {
        existing.qty += item.qty
        existing.revenue += item.lineTotal
        existing.profit += itemProfit
      } else {
        productSales.set(item.productId, {
          name: item.productName,
          qty: item.qty,
          revenue: item.lineTotal,
          profit: itemProfit
        })
      }
    }
  }

  const grossProfit = totalSales - totalCost
  const topProducts = Array.from(productSales.entries())
    .map(([id, v]) => ({ productId: id, productName: v.name, qtySold: v.qty, revenue: v.revenue, profit: v.profit }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  return {
    date: new Date().toISOString().split('T')[0],
    totalSales,
    totalCost,
    grossProfit,
    profitMargin: totalSales > 0 ? (grossProfit / totalSales) * 100 : 0,
    totalTransactions: sales.length,
    cashSales,
    mpesaSales,
    topProducts,
    salesByHour: hourlySales,
    voidCount: 0,
    averageSaleValue: sales.length > 0 ? totalSales / sales.length : 0
  }
}

// ─── ALERTS ───────────────────────────────────────────────────
export const getUnreadAlerts = async (shopId: string): Promise<Alert[]> => {
  return db.alerts
    .where({ shopId, isRead: 0 as unknown as boolean })
    .toArray()
}

export const checkAndCreateLowStockAlerts = async (shopId: string): Promise<void> => {
  const lowStock = await getLowStockProducts(shopId)
  for (const product of lowStock) {
    const existing = await db.alerts
      .where({ shopId, type: 'low_stock', productId: product.id, isRead: 0 as unknown as boolean })
      .first()
    if (!existing) {
      await db.alerts.put({
        id: crypto.randomUUID(),
        shopId,
        type: 'low_stock',
        message: `Stoki ya "${product.name}" imeshuka — ${product.qtyInStock} ${product.unit} zimebaki. Reorder level: ${product.reorderLevel}.`,
        productId: product.id,
        isRead: false,
        createdAt: new Date().toISOString()
      })
    }
  }
}

// ─── SYNC QUEUE ───────────────────────────────────────────────
export const addToSyncQueue = async (
  type: SyncQueueItem['type'],
  payload: unknown
): Promise<void> => {
  await db.syncQueue.put({
    id: crypto.randomUUID(),
    type,
    payload,
    attempts: 0,
    createdAt: new Date().toISOString()
  })
}

export const getPendingSyncItems = async (): Promise<SyncQueueItem[]> => {
  return db.syncQueue.where('attempts').below(3).toArray()
}

export const removeSyncItem = async (id: string): Promise<void> => {
  await db.syncQueue.delete(id)
}

export const incrementSyncAttempts = async (id: string): Promise<void> => {
  await db.syncQueue.where('id').equals(id).modify(item => { item.attempts += 1 })
}

// ─── UTILITIES ────────────────────────────────────────────────
export const generateSKU = (name: string): string => {
  const prefix = name.substring(0, 3).toUpperCase().replace(/\s/g, '')
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${suffix}`
}
