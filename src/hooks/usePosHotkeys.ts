import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface PosHotkeyHandlers {
  focusSearch: () => void
  newPurchase: () => void
  goBack: () => void
}

export function usePosHotkeys(handlers: PosHotkeyHandlers) {
  const navigate = useNavigate()
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const bindings = {
      F1: () => handlersRef.current.focusSearch(),
      F2: () => handlersRef.current.newPurchase(),
      F3: () => navigate('/customers'),
      F4: () => navigate('/vip'),
      Escape: () => handlersRef.current.goBack(),
    }

    const handler = (e: KeyboardEvent) => {
      const key = e.key
      if (key === 'Escape' && bindings.Escape) {
        e.preventDefault()
        bindings.Escape()
        return
      }
      if (key in bindings && key.startsWith('F')) {
        e.preventDefault()
        bindings[key as keyof typeof bindings]?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate])
}
