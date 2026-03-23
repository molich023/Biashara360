// netlify/functions/activate-license.ts
import type { Handler } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const generateChecksum = async (data: string): Promise<string> => {
  const encoder = new TextEncoder()
  const buffer = await crypto.subtle.digest('SHA-256',
    encoder.encode(data + 'B360_SECRET_SALT_2025'))
  const bytes = new Uint8Array(buffer)
  return CHARS[bytes[0] % CHARS.length] + CHARS[bytes[1] % CHARS.length]
}

const parseLicenseKey = (key: string) => {
  const parts = key.trim().toUpperCase().split('-')
  if (parts.length !== 5 || parts[0] !== 'B360') return null
  const [, tier, yearStr, unique, checksum] = parts
  const year = parseInt(yearStr)
  if (isNaN(year) || unique.length !== 6 || checksum.length !== 2) return null
  return { tier, year, unique, checksum }
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { key } = JSON.parse(event.body || '{}')
    const parsed = parseLicenseKey(key)

    if (!parsed) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ valid: false, error: 'Invalid key format' })
      }
    }

    // Check expiry
    const isLifetime = parsed.year === 9999
    const expiryDate = isLifetime
      ? new Date('2099-12-31')
      : new Date(parsed.year, 11, 31)

    if (!isLifetime && expiryDate < new Date()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ valid: false, error: 'License key has expired' })
      }
    }

    // Check in database
    try {
      const sql = neon(process.env.NETLIFY_DATABASE_URL!)
      const rows = await sql`
        SELECT * FROM license_keys
        WHERE key_hash = ${key}
        AND is_active = true
        LIMIT 1
      `

      if (rows.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ valid: false, error: 'License key not found or already used' })
        }
      }

      const license = rows[0]

      // Increment device count
      await sql`
        UPDATE license_keys
        SET device_count = device_count + 1,
            last_activated = NOW()
        WHERE key_hash = ${key}
      `

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          tier: parsed.tier,
          isLifetime,
          expiresAt: expiryDate.toISOString(),
          shopName: license.shop_name
        })
      }
    } catch {
      // DB not available — do format-only validation
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          tier: parsed.tier,
          isLifetime,
          expiresAt: expiryDate.toISOString(),
          offline: true
        })
      }
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ valid: false, error: 'Server error' })
    }
  }
}
