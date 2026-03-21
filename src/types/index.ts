// ─── SHOP / AUTH ──────────────────────────────────────────────
export interface Shop {
  id: string
  name: string
  businessType: BusinessType
  phone: string            // Safaricom number e.g. 0704658022
  mpesaTill?: string       // Till or Paybill number
  mpesaPaybill?: string
  tier: 'trial' | 'ndogo' | 'kati' | 'kubwa'
  trialEnds?: string       // ISO date
  subscriptionExpires?: string
  currency: 'KES'
  vatRate: number          // default 0 (set 16 if VAT registered)
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
  pinHash: string          // bcrypt hash stored locally
  isActive: boolean
  createdAt: string
}

// ─── PRODUCTS ─────────────────────────────────────────────────
export interface Product {
  id: string
  shopId: string
  name: string
  sku: string              // auto-generated or barcode
  barcode?: string
  category: string
  costPrice: number        // buying price
  sellingPrice: number     // POS price
  unit: ProductUnit
  qtyInStock: number
  reorderLevel: number     // alert when stock hits this
  expiryDate?: string      // ISO date — nullable
  imageUrl?: string        // Netlify Blobs URL
  isActive: boolean
  updatedAt: string        // for sync conflict resolution
  synced: boolean          // false = needs sync to server
}

export type ProductUnit =
  | 'piece' | 'kg' | 'g' | 'litre' | 'ml'
  | 'dozen' | 'carton' | 'pack' | 'pair'
  | 'metre' | 'service'

// ─── CART (in-memory only, never persisted) ────────────────────
export interface CartItem {
  product: Product
  qty: number
  unitPrice: number        // selling price at time of sale
  lineTotal: number
}

// ─── SALES ────────────────────────────────────────────────────
export interface Sale {
  id: string               // UUID generated client-side
  shopId: string
  cashierId: string
  customerId?: string
  items: SaleItem[]
  totalAmount: number      // before discount
  discount: number
  netAmount: number        // charged to customer
  paymentMethod: PaymentMethod
  cashReceived?: number
  changeGiven?: number
  mpesaPhone?: string      // phone STK Push was sent to
  mpesaCode?: string       // confirmation code from Safaricom
  mpesaAmount?: number     // M-Pesa portion (for split payments)
  note?: string
  soldAt: string           // ISO timestamp — immutable
  isVoid: boolean
  synced: boolean          // offline sync flag
}

export interface SaleItem {
  productId: string
  productName: string      // snapshot at time of sale
  qty: number
  unitPrice: number
  costAtSale: number       // for margin calculation
  lineTotal: number
}

export type PaymentMethod = 'cash' | 'mpesa' | 'split' | 'credit'

// ─── MPESA ────────────────────────────────────────────────────
export interface MpesaSTKRequest {
  phone: string            // 254XXXXXXXXX format
  amount: number
  accountRef: string       // e.g. sale ID
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
  hour: number             // 0–23
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

// ─── API RESPONSES ────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}
