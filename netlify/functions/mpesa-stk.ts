// netlify/functions/mpesa-stk.ts
// This runs SERVER-SIDE on Netlify — M-Pesa keys never reach the browser

import type { Handler, HandlerEvent } from '@netlify/functions'
import { neon } from '@neondatabase/serverless'

const MPESA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

// Get OAuth token from Safaricom
const getAccessToken = async (): Promise<string> => {
  const key = process.env.MPESA_CONSUMER_KEY!
  const secret = process.env.MPESA_CONSUMER_SECRET!
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64')

  const res = await fetch(
    `${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  )

  const data = await res.json() as { access_token: string }
  return data.access_token
}

// Generate Safaricom password (base64 of shortcode+passkey+timestamp)
const generatePassword = (timestamp: string): string => {
  const shortcode = process.env.MPESA_SHORTCODE!
  const passkey = process.env.MPESA_PASSKEY!
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64')
}

export const handler: Handler = async (event: HandlerEvent) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { phone, amount, accountRef, description } = JSON.parse(event.body || '{}')

    // Validate inputs
    if (!phone || !amount || amount < 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Nambari ya simu au kiasi hakipo sahihi.' })
      }
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14)

    const token = await getAccessToken()
    const password = generatePassword(timestamp)

    const callbackUrl = `${process.env.APP_URL}/.netlify/functions/mpesa-callback`

    const stkRes = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: process.env.MPESA_SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phone,
        PartyB: process.env.MPESA_SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: accountRef || 'BIASHARA360',
        TransactionDesc: description || 'Malipo ya bidhaa'
      })
    })

    const stkData = await stkRes.json() as {
      ResponseCode?: string
      CheckoutRequestID?: string
      CustomerMessage?: string
      errorMessage?: string
    }

    if (stkData.ResponseCode === '0') {
      // Store pending transaction in DB for callback matching
      try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL!)
        await sql`
          INSERT INTO mpesa_transactions 
            (checkout_request_id, phone, amount, account_ref, status, created_at)
          VALUES 
            (${stkData.CheckoutRequestID}, ${phone}, ${amount}, ${accountRef}, 'pending', NOW())
          ON CONFLICT (checkout_request_id) DO NOTHING
        `
      } catch {
        // DB error shouldn't block the STK Push response
        console.error('DB insert failed for pending transaction')
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          checkoutRequestId: stkData.CheckoutRequestID,
          customerMessage: stkData.CustomerMessage || 'Angalia simu yako. Ingiza PIN yako ya M-Pesa.'
        })
      }
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: stkData.errorMessage || 'M-Pesa haikufanya kazi. Jaribu tena.'
        })
      }
    }
  } catch (err) {
    console.error('STK Push error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Hitilafu ya seva. Jaribu tena baadaye.' })
    }
  }
}
