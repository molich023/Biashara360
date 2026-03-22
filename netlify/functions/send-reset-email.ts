// netlify/functions/send-reset-email.ts
// Sends PIN reset email using Resend.com (free tier: 3,000 emails/month)
// Sign up at resend.com — get free API key — add as RESEND_API_KEY env variable

import type { Handler } from '@netlify/functions'

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString()

// In-memory store for codes (resets on function cold start)
// For production: store in Neon DB with expiry
const codes = new Map<string, { code: string; expires: number }>()

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { email } = JSON.parse(event.body || '{}')

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Invalid email address.' })
      }
    }

    const code = generateCode()
    const expires = Date.now() + 15 * 60 * 1000 // 15 minutes

    // Store code
    codes.set(email.toLowerCase(), { code, expires })

    const resendKey = process.env.RESEND_API_KEY

    if (!resendKey) {
      // Dev mode — return code directly (remove in production!)
      console.log(`[DEV] Reset code for ${email}: ${code}`)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          code, // Only returned when RESEND_API_KEY not set
          message: 'Dev mode: code returned directly'
        })
      }
    }

    // Send via Resend.com
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'BIASHARA360 <onboarding@resend.dev>',
        to: [email],
        subject: 'Your BIASHARA360 PIN Reset Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h1 style="color: #00d4a0; font-size: 28px; margin-bottom: 8px;">BIASHARA360</h1>
            <p style="color: #666; font-size: 14px;">PIN Reset Request</p>
            <div style="background: #0a0f1e; border: 2px solid #00d4a0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <p style="color: #6b8fa8; font-size: 12px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;">Your Reset Code</p>
              <p style="color: #00d4a0; font-size: 48px; font-weight: bold; letter-spacing: 8px; margin: 0;">${code}</p>
              <p style="color: #6b8fa8; font-size: 12px; margin-top: 12px;">Valid for 15 minutes</p>
            </div>
            <p style="color: #666; font-size: 13px;">Enter this code in the BIASHARA360 app to reset your PIN.</p>
            <p style="color: #999; font-size: 12px; margin-top: 24px;">If you did not request this, ignore this email. Your PIN remains unchanged.</p>
            <hr style="border: none; border-top: 1px solid #1e3048; margin: 24px 0;" />
            <p style="color: #333; font-size: 11px;">BIASHARA360 · Ngong Hills, Kenya · molich60@gmail.com</p>
          </div>
        `
      })
    })

    if (emailRes.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Reset code sent to your email.' })
      }
    } else {
      const err = await emailRes.json()
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, error: 'Could not send email: ' + (err.message || 'Unknown error') })
      }
    }
  } catch (err) {
    console.error('send-reset-email error:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Server error. Try again.' })
    }
  }
}
