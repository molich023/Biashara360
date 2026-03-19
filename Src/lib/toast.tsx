import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface ToastContextType {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-2), { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const icons = { success: CheckCircle, error: XCircle, info: Info }
  const styles = {
    success: 'bg-emerald-800 border border-emerald-600 text-emerald-100',
    error:   'bg-red-900 border border-red-700 text-red-100',
    info:    'bg-blue-900 border border-blue-700 text-blue-100'
  }

  return (
    <ToastContext.Provider value={{
      success: (m) => add('success', m),
      error:   (m) => add('error', m),
      info:    (m) => add('info', m)
    }}>
      {children}
      <div className="fixed top-4 left-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => {
          const Icon = icons[t.type]
          return (
            <div key={t.id} className={`toast ${styles[t.type]} pointer-events-auto`}>
              <Icon size={18} className="flex-shrink-0 mt-0.5" />
              <span className="flex-1 text-sm leading-snug">{t.message}</span>
              <button onClick={() => remove(t.id)} className="flex-shrink-0 opacity-70 active:opacity-100">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
