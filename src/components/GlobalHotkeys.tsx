import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useHotkeys } from '../hooks/useHotkeys'

/** Manager routes: F1–F4 quick navigation (disabled on POS — POS has its own layer). */
export function GlobalHotkeys() {
  const navigate = useNavigate()
  const location = useLocation()
  const onPos = location.pathname === '/pos'

  const bindings = useMemo(
    () => ({
      F1: () => navigate('/pos'),
      F2: () => navigate('/pos', { state: { newPurchase: true } }),
      F3: () => navigate('/customers'),
      F4: () => navigate('/vip'),
    }),
    [navigate],
  )

  useHotkeys(bindings, !onPos)

  return null
}
