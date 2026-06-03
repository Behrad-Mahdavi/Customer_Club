import type { ReactNode } from 'react'

interface NumericProps {
  children: ReactNode
  className?: string
}

/** Numbers, currency, and phone strings in RTL layouts */
export function Numeric({ children, className }: NumericProps) {
  const classes = ['numeric', className].filter(Boolean).join(' ')
  return <span className={classes}>{children}</span>
}
