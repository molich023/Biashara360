// netlify/functions/mpesa-callback.ts
// Safaricom calls this URL after customer enters M-Pesa PIN

import type { Handler, HandlerEvent } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

interface MpesaCallback {
  Body: {
    stkCallback: {
      MerchantRequestID: string
      CheckoutRequestID: string
      ResultCode: number        // 0 = success, anything else = failed
      ResultDesc: string
      CallbackMetadata?: {
        Item: Array<{ Name: string; Value?: string | number }>
      }
    }
  }
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const callback = JSON.parse(event.body || '{}') as MpesaCallback
    const stk = callback.Body?.stkCallback

    if (!stk) {
      return { statusCode: 400, body: 'Invalid callback payload' }
    }

    const sql = neon(process.env.NETLIFY_DATABASE_URL!)

    if (stk.ResultCode === 0) {
      // ✅ Payment successful — extract transaction details
      const items = stk.CallbackMetadata?.Item || []
      const getValue = (name: string) =>
        items.find(i => i.Name === name)?.Value

      const mpesaCode = getValue('MpesaReceiptNumber') as string
      const amount = getValue('Amount') as number
      const phone = getValue('PhoneNumber') as string

      await sql`
        UPDATE mpesa_transactions
        SET 
          status = 'success',
          mpesa_code = ${mpesaCode},
          amount_paid = ${amount},
          phone_paid = ${phone?.toString()},
          completed_at = NOW()
        WHERE checkout_request_id = ${stk.CheckoutRequestID}
      `
    } else {
      // ❌ Payment failed or cancelled
      await sql`
        UPDATE mpesa_transactions
        SET 
          status = 'failed',
          failure_reason = ${stk.ResultDesc},
          completed_at = NOW()
        WHERE checkout_request_id = ${stk.CheckoutRequestID}
      `
    }

    // Safaricom expects a 200 OK response
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' })
    }
  } catch (err) {
    console.error('Callback error:', err)
    return { statusCode: 500, body: 'Internal error' }
  }
}
