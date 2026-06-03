import { Tile } from '@carbon/react'
import { formatCurrency, formatNumber } from '../lib/format'
import { Numeric } from './Numeric'

interface StatTileProps {
  label: string
  value: string | number
  isCurrency?: boolean
  description?: string
}

export function StatTile({ label, value, isCurrency, description }: StatTileProps) {
  const display =
    typeof value === 'number'
      ? isCurrency
        ? formatCurrency(value)
        : formatNumber(value)
      : value

  return (
    <Tile className="stat-tile">
      <p className="stat-tile__label">{label}</p>
      <p className="stat-tile__value">
        <Numeric>{display}</Numeric>
      </p>
      {description && <p className="stat-tile__desc">{description}</p>}
    </Tile>
  )
}
