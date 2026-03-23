import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Shop, User } from '@/types'
import { db, getShop, getOwner } from '@/db/local'

// ─── PIN HASHING ──────────────────────────────────────────────
const hashPin = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'biashara360_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const verifyPin = async (pin: string, hash: string): Promise<boolean> => {
  const computed = await hashPin(pin)
  return computed === hash
}

export const createPinHash = hashPin

// ─── TRIAL STATUS ─────────────────────────────────────────────
export const getTrialStatus = (shop: Shop): {
  isExpired: boolean
  daysLeft: number
  isActive: boolean
} => {
  // Check paid subscription first
  if (shop.subscriptionExpires) {
    const expires = new Date(shop.subscriptionExpires)
    if (expires > new Date()) {
      return { isExpired: false, daysLeft: 999, isActive: true }
    }
  }

  // Check trial
  if (shop.tier === 'trial' && shop.trialEnds) {
    const trialEnd = new Date(shop.trialEnds)
    const now = new Date()
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)

    if (trialEnd < now) {
      return { isExpired: true, daysLeft: 0, isActive: false }
    }
    return { isExpired: false, daysLeft, isActive: true }
  }

  // No trial, no subscription = expired
  if (shop.tier === 'trial' && !shop.trialEnds) {
    return { isExpired: true, daysLeft: 0, isActive: false }
  }

  // Paid tier without expiry = active (lifetime)
  return { isExpired: false, daysLeft: 999, isActive: true }
}

// ─── IDLE TIMEOUT — 10 MINUTES ────────────────────────────────
const IDLE_TIMEOUT_MS = 10 * 60 * 1000

// ─── AUTH CONTEXT ─────────────────────────────────────────────
interface AuthState {
  shop: Shop | null
  user: User | null
  isAuthenticated: boolean
  isSetupComplete: boolean
  isTrialExpired: boolean
  trialDaysLeft: number
  pinAttempts: number
  isLockedOut: boolean
  lockoutUntil: number | null
}

interface AuthContextType extends AuthState {
  login: (pin: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  refreshShop: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

// ─── AUTH PROVIDER ────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    shop: null,
    user: null,
    isAuthenticated: false,
    isSetupComplete: false,
    isTrialExpired: false,
    trialDaysLeft: 7,
    pinAttempts: 0,
    isLockedOut: false,
    lockoutUntil: null
  })

  // Check lockout on mount
  useEffect(() => {
    const lockoutUntil = localStorage.getItem('b360_lockout')
    if (lockoutUntil) {
      const lockTime = parseInt(lockoutUntil)
      if (Date.now() < lockTime) {
        setState(s => ({ ...s, isLockedOut: true, lockoutUntil: lockTime }))
        setTimeout(() => {
          localStorage.removeItem('b360_lockout')
          setState(s => ({ ...s, isLockedOut: false, lockoutUntil: null, pinAttempts: 0 }))
        }, lockTime - Date.now())
      } else {
        localStorage.removeItem('b360_lockout')
      }
    }
  }, [])

  // Load shop on mount
  useEffect(() => {
    const init = async () => {
      const shop = await getShop()
      if (shop) {
        const { isExpired, daysLeft } = getTrialStatus(shop)
        setState(s => ({
          ...s,
          shop,
          isSetupComplete: true,
          isTrialExpired: isExpired,
          trialDaysLeft: daysLeft
        }))
      }
    }
    init()
  }, [])

  // ─── IDLE TIMEOUT ───────────────────────────────────────────
  useEffect(() => {
    if (!state.isAuthenticated) return
    let timer: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        setState(s => ({ ...s, isAuthenticated: false, user: null }))
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['touchstart', 'click', 'keydown', 'scroll']
    events.forEach(e => document.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      clearTimeout(timer)
      events.forEach(e => document.removeEventListener(e, resetTimer))
    }
  }, [state.isAuthenticated])

  // ─── LOGIN ───────────────────────────────────────────────────
  const login = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (state.isLockedOut) {
      const mins = Math.ceil(((state.lockoutUntil || 0) - Date.now()) / 60000)
      return { success: false, error: `Jaribu tena baada ya dakika ${mins}.` }
    }

    const shop = await getShop()
    if (!shop) return { success: false, error: 'Duka halijapatikana.' }

    const owner = await getOwner(shop.id)
    if (!owner) return { success: false, error: 'Mtumiaji hajapatikana.' }

    const valid = await verifyPin(pin, owner.pinHash)

    if (!valid) {
      const newAttempts = state.pinAttempts + 1
      if (newAttempts >= 5) {
        const lockUntil = Date.now() + 10 * 60 * 1000
        localStorage.setItem('b360_lockout', lockUntil.toString())
        setState(s => ({ ...s, pinAttempts: 0, isLockedOut: true, lockoutUntil: lockUntil }))
        setTimeout(() => {
          localStorage.removeItem('b360_lockout')
          setState(s => ({ ...s, isLockedOut: false, lockoutUntil: null }))
        }, 10 * 60 * 1000)
        return { success: false, error: 'PIN mbaya mara 5. Imefungiwa kwa dakika 10.' }
      }
      setState(s => ({ ...s, pinAttempts: newAttempts }))
      return { success: false, error: `PIN si sahihi. Majaribio ${5 - newAttempts} yamebaki.` }
    }

    // Check trial/subscription
    const { isExpired, daysLeft } = getTrialStatus(shop)

    setState(s => ({
      ...s,
      shop,
      user: owner,
      isAuthenticated: true,
      isTrialExpired: isExpired,
      trialDaysLeft: daysLeft,
      pinAttempts: 0
    }))

    return { success: true }
  }, [state.isLockedOut, state.lockoutUntil, state.pinAttempts])

  const logout = useCallback(() => {
    setState(s => ({ ...s, isAuthenticated: false, user: null }))
  }, [])

  const refreshShop = useCallback(async () => {
    const shop = await getShop()
    if (shop) {
      const { isExpired, daysLeft } = getTrialStatus(shop)
      setState(s => ({
        ...s,
        shop,
        isTrialExpired: isExpired,
        trialDaysLeft: daysLeft
      }))
    }
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshShop }}>
      {children}
    </AuthContext.Provider>
  )
}
