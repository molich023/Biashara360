import React, { useState, useEffect } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { db } from '@/db/local'
import { useLiveQuery } from 'dexie-react-hooks'

export const SyncBar: React.FC = () => {
  const [online, setOnline] = useState(navigator.onLine)

  const pendingCount = useLiveQuery(
    () => db.syncQueue.count(),
    [], 0
  )

  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // Don't show bar if all is well
  if (online && !pendingCount) return null

  return (
    <div className={`flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium
      ${online ? 'bg-yellow-900/80 text-yellow-300' : 'bg-red-900/80 text-red-300'}`}>
      {online ? (
        <>
          <RefreshCw size={12} className="animate-spin" />
          <span>Inasync... ({pendingCount} zinasubiri)</span>
        </>
      ) : (
        <>
          <WifiOff size={12} />
          <span>Nje ya mtandao — mauzo yanaokolewa kwenye simu</span>
        </>
      )}
    </div>
  )
}
