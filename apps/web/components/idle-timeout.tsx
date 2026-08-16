'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/auth'

const IDLE_MS = 20 * 60 * 1000 // 20 minutes of no activity → auto logout

/**
 * Logs the user out after 20 minutes with no interaction (mouse, keyboard,
 * scroll, touch). Any activity resets the timer. Mounted only when authenticated.
 */
export function IdleTimeout() {
  const router = useRouter()
  const logout = useAuthStore((s) => s.logout)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    const doLogout = async () => {
      try { await logout() } catch { /* ignore */ }
      if (!cancelled) router.replace('/login')
    }

    const arm = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(doLogout, IDLE_MS)
    }

    const onActivity = () => {
      const now = Date.now()
      if (now - lastRef.current < 1000) return // throttle timer resets to once/sec
      lastRef.current = now
      arm()
    }

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    arm()

    return () => {
      cancelled = true
      events.forEach((e) => window.removeEventListener(e, onActivity))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [logout, router])

  return null
}
