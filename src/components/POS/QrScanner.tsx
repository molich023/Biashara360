import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (code: string) => void
  onClose: () => void
}

export const QrScanner: React.FC<Props> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannedRef = useRef(false)

  useEffect(() => {
    const start = async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          (decodedText) => {
            if (scannedRef.current) return
            scannedRef.current = true
            if (navigator.vibrate) navigator.vibrate(100)
            onScan(decodedText)
          },
          () => {}
        )
      } catch (err) {
        console.error('Camera error:', err)
        onClose()
      }
    }
    start()
    return () => { scannerRef.current?.stop().catch(() => {}) }
  }, [onScan, onClose])

  return (
    <div className="fixed inset-0 z-[150] bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 bg-black/80">
        <h2 className="text-white font-semibold">Scan QR / Barcode</h2>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <X size={18} className="text-white" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <div id="qr-reader" className="w-full max-w-sm" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 relative">
            {['top-0 left-0 border-t-4 border-l-4 rounded-tl-lg','top-0 right-0 border-t-4 border-r-4 rounded-tr-lg','bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg','bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg'].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 border-brand ${cls}`} />
            ))}
            <div className="absolute left-2 right-2 h-0.5 bg-brand/70 top-1/2 animate-pulse" />
          </div>
        </div>
      </div>
      <div className="bg-black/80 px-4 py-4 text-center">
        <p className="text-gray-400 text-sm">Elekeza kamera kwenye QR code au barcode</p>
      </div>
    </div>
  )
}
