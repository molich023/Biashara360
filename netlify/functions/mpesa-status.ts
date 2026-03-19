// netlify/functions/mpesa-status.ts
// App polls this to check if customer completed M-Pesa payment

import type { Handler, HandlerEvent } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

export const handler: Handler = async (event: HandlerEvent) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Content-Type': 'application/json'
  }

  const checkoutRequestId = event.queryStringParameters?.id

  if (!checkoutRequestId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing checkout request ID' })
    }
  }

  try {
    const sql = neon(process.env.NETLIFY_DATABASE_URL!)
    const rows = await sql`
      SELECT status, mpesa_code, amount_paid, phone_paid
      FROM mpesa_transactions
      WHERE checkout_request_id = ${checkoutRequestId}
      LIMIT 1
    `

    if (rows.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ status: 'not_found' })
      }
    }

    const tx = rows[0]
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: tx.status,             // 'pending' | 'success' | 'failed'
        mpesaCode: tx.mpesa_code,
        amount: tx.amount_paid,
        phone: tx.phone_paid
      })
    }
  } catch (err) {
    console.error('Status check error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error' })
    }
  }
}
