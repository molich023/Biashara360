// netlify/functions/sync-sale.ts
// Receives offline sales from client and persists to Neon DB

import type { Handler, HandlerEvent } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'
import type { Sale } from '../../src/types/index'

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const sale = JSON.parse(event.body || '{}') as Sale
    if (!sale.id || !sale.shopId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid sale data' }) }
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!)

    // Insert sale (ignore if already exists — idempotent)
    await sql`
      INSERT INTO sales (
        id, shop_id, cashier_id, total_amount, discount, net_amount,
        payment_method, cash_received, change_given, mpesa_phone,
        mpesa_code, mpesa_amount, note, sold_at, is_void
      ) VALUES (
        ${sale.id}, ${sale.shopId}, ${sale.cashierId},
        ${sale.totalAmount}, ${sale.discount}, ${sale.netAmount},
        ${sale.paymentMethod}, ${sale.cashReceived ?? null},
        ${sale.changeGiven ?? null}, ${sale.mpesaPhone ?? null},
        ${sale.mpesaCode ?? null}, ${sale.mpesaAmount ?? null},
        ${sale.note ?? null}, ${sale.soldAt}, ${sale.isVoid}
      )
      ON CONFLICT (id) DO NOTHING
    `

    // Insert sale items
    for (const item of sale.items) {
      await sql`
        INSERT INTO sale_items (
          sale_id, product_id, product_name, qty, unit_price, cost_at_sale, line_total
        ) VALUES (
          ${sale.id}, ${item.productId}, ${item.productName},
          ${item.qty}, ${item.unitPrice}, ${item.costAtSale}, ${item.lineTotal}
        )
        ON CONFLICT DO NOTHING
      `
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('sync-sale error:', err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error' }) }
  }
}
