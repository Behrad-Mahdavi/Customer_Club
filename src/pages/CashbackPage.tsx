import { useEffect, useState } from 'react'
import { Button, NumberInput, Tile, Loading } from '@carbon/react'
import { toast } from 'sonner'
import type { CashbackRule } from '../types/api'
import { formatCurrency } from '../lib/format'
import { Numeric } from '../components/Numeric'

const PREVIEW_AMOUNT = 1_000_000

export function CashbackPage() {
  const [rule, setRule] = useState<CashbackRule | null>(null)
  const [percentage, setPercentage] = useState(5)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.cashback
      .getRule()
      .then((r) => {
        setRule(r)
        setPercentage(r.percentage)
      })
      .finally(() => setLoading(false))
  }, [])

  const previewCashback = (() => {
    const maxCap = rule && rule.maximumAmount > 0 ? rule.maximumAmount : Infinity
    return Math.min((PREVIEW_AMOUNT * percentage) / 100, maxCap)
  })()

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await window.api.cashback.updateRule({ percentage })
      setRule(updated)
      toast.success('قوانین کش‌بک ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !rule) return <Loading withOverlay={false} description="در حال بارگذاری..." />

  return (
    <div className="page">
      <h1 className="page-title">قوانین کش‌بک</h1>

      <div className="cashback-layout">
        <Tile className="form-tile">
          <h2 className="tile-heading">قانون فعلی</h2>
          <NumberInput
            id="percentage"
            label="درصد کش‌بک"
            value={percentage}
            onChange={(_, { value }) => setPercentage(Number(value))}
            min={0}
            max={100}
            step={0.5}
          />
          <Button kind="primary" disabled={saving} onClick={handleSave}>
            {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </Button>
        </Tile>

        <Tile className="example-tile">
          <h2 className="tile-heading">پیش‌نمایش</h2>
          <div className="cashback-preview">
            <div>
              <span>خرید</span>
              <strong><Numeric>{formatCurrency(PREVIEW_AMOUNT)}</Numeric></strong>
            </div>
            <div>
              <span>کش‌بک</span>
              <strong className="cashback-preview-value"><Numeric>{formatCurrency(previewCashback)}</Numeric></strong>
            </div>
          </div>
        </Tile>
      </div>
    </div>
  )
}
