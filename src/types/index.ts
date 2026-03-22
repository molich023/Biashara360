// ─── SHOP LOCATION ────────────────────────────────────────────
export interface ShopLocation {
  country: string          // ISO code e.g. KE, UG, TZ
  county: string           // e.g. Nairobi, Kampala
  town: string             // e.g. Ngong, CBD, Westlands
}

// ─── SHOP / AUTH ──────────────────────────────────────────────
export interface Shop {
  id: string
  name: string
  businessType: BusinessType
  phone: string
  mpesaTill?: string
  mpesaPaybill?: string
  tier: 'trial' | 'ndogo' | 'kati' | 'kubwa'
  trialEnds?: string
  subscriptionExpires?: string
  currency: string         // KES, UGX, TZS, etc
  vatRate: number
  location?: ShopLocation  // country, county, town
  language?: 'sw' | 'en'  // preferred language
  createdAt: string
}

export type BusinessType =
  | 'kiosk' | 'minimarket' | 'supermarket'
  | 'salon' | 'barbershop'
  | 'pub' | 'hotel' | 'restaurant' | 'cafe'
  | 'clothing' | 'shoes' | 'mitumba'
  | 'pharmacy' | 'hardware'
  | 'vegetable' | 'butchery' | 'grain'
  | 'electronics' | 'other'

export interface User {
  id: string
  shopId: string
  name: string
  role: 'owner' | 'manager' | 'cashier'
  pinHash: string
  isActive: boolean
  createdAt: string
}

// ─── PRODUCTS ─────────────────────────────────────────────────
export interface Product {
  id: string
  shopId: string
  name: string
  sku: string
  barcode?: string
  category: string
  costPrice: number
  sellingPrice: number
  unit: ProductUnit
  qtyInStock: number
  reorderLevel: number
  expiryDate?: string
  imageUrl?: string
  isActive: boolean
  updatedAt: string
  synced: boolean
}

export type ProductUnit =
  | 'piece' | 'kg' | 'g' | 'litre' | 'ml'
  | 'dozen' | 'carton' | 'pack' | 'pair'
  | 'metre' | 'service'

// ─── CART ─────────────────────────────────────────────────────
export interface CartItem {
  product: Product
  qty: number
  unitPrice: number
  lineTotal: number
}

// ─── SALES ────────────────────────────────────────────────────
export interface Sale {
  id: string
  shopId: string
  cashierId: string
  customerId?: string
  items: SaleItem[]
  totalAmount: number
  discount: number
  netAmount: number
  paymentMethod: PaymentMethod
  cashReceived?: number
  changeGiven?: number
  mpesaPhone?: string
  mpesaCode?: string
  mpesaAmount?: number
  note?: string
  soldAt: string
  isVoid: boolean
  synced: boolean
}

export interface SaleItem {
  productId: string
  productName: string
  qty: number
  unitPrice: number
  costAtSale: number
  lineTotal: number
}

export type PaymentMethod = 'cash' | 'mpesa' | 'split' | 'credit'

// ─── MPESA ────────────────────────────────────────────────────
export interface MpesaSTKRequest {
  phone: string
  amount: number
  accountRef: string
  description: string
}

export interface MpesaSTKResponse {
  success: boolean
  checkoutRequestId?: string
  customerMessage?: string
  error?: string
}

export interface MpesaCallbackResult {
  success: boolean
  mpesaCode?: string
  amount?: number
  phone?: string
}

// ─── REPORTS ──────────────────────────────────────────────────
export interface DailyReport {
  date: string
  totalSales: number
  totalCost: number
  grossProfit: number
  profitMargin: number
  totalTransactions: number
  cashSales: number
  mpesaSales: number
  topProducts: TopProduct[]
  salesByHour: HourlySales[]
  voidCount: number
  averageSaleValue: number
}

export interface TopProduct {
  productId: string
  productName: string
  qtySold: number
  revenue: number
  profit: number
}

export interface HourlySales {
  hour: number
  amount: number
  count: number
}

// ─── ALERTS ───────────────────────────────────────────────────
export interface Alert {
  id: string
  shopId: string
  type: 'low_stock' | 'expiry' | 'sync_error' | 'subscription'
  message: string
  productId?: string
  isRead: boolean
  createdAt: string
}

// ─── SYNC ─────────────────────────────────────────────────────
export interface SyncQueueItem {
  id: string
  type: 'sale' | 'product' | 'stock_adjustment'
  payload: unknown
  attempts: number
  createdAt: string
}

// ─── API ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}
