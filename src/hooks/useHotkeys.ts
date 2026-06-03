import { useEffect } from 'react'

type HotkeyMap = Partial<Record<'F1' | 'F2' | 'F3' | 'F4' | 'Escape', () => void>>

export function useHotkeys(bindings: HotkeyMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const key = e.key
      if (key === 'Escape' && bindings.Escape) {
        e.preventDefault()
        bindings.Escape()
        return
      }
      if (key.startsWith('F') && bindings[key as keyof HotkeyMap]) {
        e.preventDefault()
        bindings[key as keyof HotkeyMap]?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bindings, enabled])
}
