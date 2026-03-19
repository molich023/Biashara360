import { getPendingSyncItems, removeSyncItem, incrementSyncAttempts } from '@/db/local'

const API = '/api'

// Push one queued item to the server
const syncItem = async (item: Awaited<ReturnType<typeof getPendingSyncItems>>[0]): Promise<boolean> => {
  try {
    const endpoint = item.type === 'sale' ? `${API}/sync-sale`
                   : item.type === 'product' ? `${API}/sync-product`
                   : `${API}/sync-stock`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.payload),
      signal: AbortSignal.timeout(15000)
    })
    return res.ok
  } catch {
    return false
  }
}

// Run sync — called when app detects network restored
export const runSync = async (): Promise<{ synced: number; failed: number }> => {
  const pending = await getPendingSyncItems()
  let synced = 0, failed = 0

  for (const item of pending) {
    const ok = await syncItem(item)
    if (ok) {
      await removeSyncItem(item.id)
      synced++
    } else {
      await incrementSyncAttempts(item.id)
      failed++
    }
  }
  return { synced, failed }
}

// Hook into browser online/offline events
export const startSyncListener = (onSync?: (r: { synced: number; failed: number }) => void) => {
  const handler = async () => {
    if (navigator.onLine) {
      const result = await runSync()
      if (result.synced > 0) onSync?.(result)
    }
  }
  window.addEventListener('online', handler)
  // Also try on focus (user picks up phone)
  window.addEventListener('focus', handler)
  return () => {
    window.removeEventListener('online', handler)
    window.removeEventListener('focus', handler)
  }
}
