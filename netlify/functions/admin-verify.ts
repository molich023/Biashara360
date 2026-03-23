import type { Handler } from '@netlify/functions'

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': process.env.APP_URL || '*',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' }
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' }

  try {
    const { password } = JSON.parse(event.body || '{}')
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'ADMIN_PASSWORD not set in Netlify environment variables.' })
      }
    }

    if (password === adminPassword) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      }
    }

    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: 'Wrong password.' })
    }
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error.' })
    }
  }
}
