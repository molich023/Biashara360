import type { MpesaSTKRequest, MpesaSTKResponse, MpesaCallbackResult } from '@/types'

// ─── FORMAT PHONE FOR SAFARICOM ───────────────────────────────
// Converts 07XXXXXXXX or 01XXXXXXXX → 2547XXXXXXXX
export const formatMpesaPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '')
  if (clean.startsWith('254')) return clean
  if (clean.startsWith('0')) return '254' + clean.slice(1)
  if (clean.startsWith('7') || clean.startsWith('1')) return '254' + clean
  return clean
}

export const isValidKenyanPhone = (phone: string): boolean => {
  const formatted = formatMpesaPhone(phone)
  return /^254[17]\d{8}$/.test(formatted)
}

// ─── STK PUSH ─────────────────────────────────────────────────
export const initiateMpesaSTK = async (
  req: MpesaSTKRequest
): Promise<MpesaSTKResponse> => {
  try {
    const res = await fetch('/api/mpesa-stk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...req,
        phone: formatMpesaPhone(req.phone)
      }),
      signal: AbortSignal.timeout(30000) // 30s timeout
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.message || 'M-Pesa haikufanya kazi. Jaribu tena.' }
    }

    return await res.json()
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, error: 'Mtandao ni polepole. Angalia kama mteja amepokea STK Push.' }
    }
    return { success: false, error: 'Hakuna mtandao. Mauzo yatahifadhiwa bila M-Pesa.' }
  }
}

// ─── POLL STK STATUS ──────────────────────────────────────────
// Poll for up to 30 seconds waiting for customer to enter PIN
export const pollMpesaStatus = async (
  checkoutRequestId: string,
  onUpdate: (status: 'pending' | 'success' | 'failed', result?: MpesaCallbackResult) => void
): Promise<void> => {
  const maxAttempts = 10
  const intervalMs = 3000

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs))

    try {
      const res = await fetch(`/api/mpesa-status?id=${checkoutRequestId}`)
      const data = await res.json()

      if (data.status === 'success') {
        onUpdate('success', {
          success: true,
          mpesaCode: data.mpesaCode,
          amount: data.amount,
          phone: data.phone
        })
        return
      } else if (data.status === 'failed') {
        onUpdate('failed')
        return
      }
      // Still pending — continue polling
      onUpdate('pending')
    } catch {
      // Network error during polling — continue
    }
  }

  // Timeout — likely customer didn't respond
  onUpdate('failed')
}

// ─── WHATSAPP RECEIPT (No API needed) ─────────────────────────
export const generateWhatsAppReceipt = (params: {
  shopName: string
  items: Array<{ name: string; qty: number; price: number; total: number }>
  total: number
  paymentMethod: string
  mpesaCode?: string
  cashReceived?: number
  change?: number
  date: Date
}): string => {
  const { shopName, items, total, paymentMethod, mpesaCode, cashReceived, change, date } = params

  const timeStr = date.toLocaleTimeString('sw-KE', { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString('sw-KE', { day: '2-digit', month: 'short', year: 'numeric' })

  const itemLines = items
    .map(i => `  ${i.name} ×${i.qty}  KSH ${i.total.toLocaleString()}`)
    .join('\n')

  const payLine = paymentMethod === 'mpesa'
    ? `💳 M-Pesa: KSH ${total.toLocaleString()}${mpesaCode ? `\n📨 Nambari: ${mpesaCode}` : ''}`
    : paymentMethod === 'cash'
    ? `💵 Taslimu: KSH ${total.toLocaleString()}${cashReceived ? `\n↩ Chenji: KSH ${(change || 0).toLocaleString()}` : ''}`
    : `✂ Split: KSH ${total.toLocaleString()}`

  const message = `🧾 *RISITI - ${shopName.toUpperCase()}*
📅 ${dateStr} saa ${timeStr}
━━━━━━━━━━━━━━━━━━
${itemLines}
━━━━━━━━━━━━━━━━━━
💰 *JUMLA: KSH ${total.toLocaleString()}*
${payLine}
━━━━━━━━━━━━━━━━━━
_Asante kwa ununuzi! 🙏_
_Powered by BIASHARA360_`

  return message
}

export const openWhatsAppReceipt = (phone: string, message: string): void => {
  const formatted = formatMpesaPhone(phone).replace('254', '254')
  const encoded = encodeURIComponent(message)
  window.open(`https://wa.me/${formatted}?text=${encoded}`, '_blank')
}

export const shareReceiptNative = async (message: string, shopName: string): Promise<void> => {
  if (navigator.share) {
    await navigator.share({
      title: `Risiti - ${shopName}`,
      text: message
    })
  } else {
    // Fallback: copy to clipboard
    await navigator.clipboard.writeText(message)
  }
}
