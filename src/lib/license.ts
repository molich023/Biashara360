// ─── LICENSE KEY SYSTEM ───────────────────────────────────────
// Format: B360-[TIER]-[YEAR]-[UNIQUE6]-[CHECK2]
// Example: B360-MAMA-2025-K7X9W2-AB
// Security: SHA-256 checksum, tied to shopId, expiry embedded

export type LicenseTier =
  | 'MAMA'  // KSH 100 Lifetime
  | 'NDGO'  // KSH 500/year
  | 'KATI'  // KSH 2000/year
  | 'KBWA'  // KSH 5000/year
  | 'ENTP'  // KSH 50000/year

export interface LicenseInfo {
  tier: LicenseTier
  year: number           // expiry year (9999 = lifetime)
  unique: string         // 6-char unique segment
  checksum: string       // 2-char verification
  isLifetime: boolean
  expiryDate: Date
  maxDevices: number
  maxProducts: number
  isValid: boolean
}

export interface StoredLicense {
  key: string
  shopId: string
  tier: LicenseTier
  issuedAt: string
  expiresAt: string       // ISO date, "9999-12-31" for lifetime
  isLifetime: boolean
  isActive: boolean
  deviceCount: number
  maxDevices: number
}

// Pricing in KSH
export const TIER_PRICING: Record<LicenseTier, { name: string; price: number; period: string; maxDevices: number; maxProducts: number }> = {
  MAMA: { name: 'Mama Mboga',      price: 100,    period: 'Maisha yote (Lifetime)', maxDevices: 1,   maxProducts: 200   },
  NDGO: { name: 'Biashara Ndogo',  price: 500,    period: 'Kwa mwaka (Annual)',     maxDevices: 1,   maxProducts: 500   },
  KATI: { name: 'Biashara Kati',   price: 2000,   period: 'Kwa mwaka (Annual)',     maxDevices: 3,   maxProducts: 99999 },
  KBWA: { name: 'Biashara Kubwa',  price: 5000,   period: 'Kwa mwaka (Annual)',     maxDevices: 10,  maxProducts: 99999 },
  ENTP: { name: 'Enterprise',      price: 50000,  period: 'Kwa mwaka (Annual)',     maxDevices: 999, maxProducts: 99999 },
}

// ─── GENERATE UNIQUE 6-CHAR SEGMENT ──────────────────────────
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no confusing chars

const generateUnique = (): string => {
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return result
}

// ─── GENERATE CHECKSUM ────────────────────────────────────────
const generateChecksum = async (data: string): Promise<string> => {
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data + 'B360_SECRET_SALT_2025'))
  const bytes = new Uint8Array(buffer)
  // Take first 2 chars from hash
  return CHARS[bytes[0] % CHARS.length] + CHARS[bytes[1] % CHARS.length]
}

// ─── GENERATE LICENSE KEY ─────────────────────────────────────
export const generateLicenseKey = async (
  tier: LicenseTier,
  shopId: string
): Promise<string> => {
  const isLifetime = tier === 'MAMA'
  const year = isLifetime ? 9999 : new Date().getFullYear() + 1
  const unique = generateUnique()
  const data = `${tier}-${year}-${unique}-${shopId}`
  const checksum = await generateChecksum(data)
  return `B360-${tier}-${year}-${unique}-${checksum}`
}

// ─── PARSE LICENSE KEY ────────────────────────────────────────
export const parseLicenseKey = (key: string): {
  valid: boolean
  tier?: LicenseTier
  year?: number
  unique?: string
  checksum?: string
} => {
  const parts = key.trim().toUpperCase().split('-')
  // B360 - TIER - YEAR - UNIQUE6 - CHECK2
  if (parts.length !== 5) return { valid: false }
  if (parts[0] !== 'B360') return { valid: false }

  const tier = parts[1] as LicenseTier
  if (!TIER_PRICING[tier]) return { valid: false }

  const year = parseInt(parts[2])
  if (isNaN(year)) return { valid: false }

  const unique = parts[3]
  if (unique.length !== 6) return { valid: false }

  const checksum = parts[4]
  if (checksum.length !== 2) return { valid: false }

  return { valid: true, tier, year, unique, checksum }
}

// ─── VALIDATE LICENSE KEY (client side basic) ─────────────────
export const validateLicenseKeyFormat = (key: string): boolean => {
  return parseLicenseKey(key).valid
}

// ─── GET LICENSE INFO ─────────────────────────────────────────
export const getLicenseInfo = (key: string): LicenseInfo | null => {
  const parsed = parseLicenseKey(key)
  if (!parsed.valid || !parsed.tier || !parsed.year) return null

  const tier = parsed.tier
  const pricing = TIER_PRICING[tier]
  const isLifetime = parsed.year === 9999
  const expiryDate = isLifetime
    ? new Date('2099-12-31')
    : new Date(parsed.year, 11, 31) // Dec 31 of expiry year

  return {
    tier,
    year: parsed.year,
    unique: parsed.unique!,
    checksum: parsed.checksum!,
    isLifetime,
    expiryDate,
    maxDevices: pricing.maxDevices,
    maxProducts: pricing.maxProducts,
    isValid: isLifetime || expiryDate > new Date()
  }
}

// ─── FORMAT LICENSE KEY FOR DISPLAY ──────────────────────────
export const formatKeyDisplay = (key: string): string => {
  return key.toUpperCase().replace(/[^A-Z0-9-]/g, '')
}
