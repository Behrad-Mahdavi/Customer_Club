import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Loading, Tile } from '@carbon/react'
import { createColumnHelper } from '@tanstack/react-table'
import { AppDataTable } from '../components/AppDataTable'
import { EmptyState } from '../components/EmptyState'
import { Numeric } from '../components/Numeric'
import { useAppStore } from '../store/app-store'
import type { VipCustomer } from '../types/api'
import { formatCurrency, formatNumber, formatRelativeDate } from '../lib/format'

const columnHelper = createColumnHelper<VipCustomer>()

const rankMedal = (rank: number) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export function VIPPage() {
  const navigate = useNavigate()
  const settings = useAppStore((s) => s.settings)
  const loadSettings = useAppStore((s) => s.loadSettings)
  const [customers, setCustomers] = useState<VipCustomer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSettings()
    window.api.customers.getVip().then(setCustomers).finally(() => setLoading(false))
  }, [loadSettings])

  const columns = useMemo(
    () => [
      columnHelper.accessor('rank', {
        header: 'رتبه',
        cell: (info) => {
          const rank = info.getValue()
          return (
            <span className="vip-rank-wrap">
              <span className="vip-rank">{rankMedal(rank)}</span>
              {rank <= 3 && <span className="vip-badge">VIP</span>}
            </span>
          )
        },
      }),
      columnHelper.accessor('fullName', {
        header: 'مشتری',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('totalOrders', {
        header: 'سفارش‌ها',
        cell: (info) => <Numeric>{formatNumber(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('totalSpent', {
        header: 'مجموع خرید',
        cell: (info) => <Numeric>{formatCurrency(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('lastPurchaseAt', {
        header: 'آخرین مراجعه',
        cell: (info) => formatRelativeDate(info.getValue()),
      }),
    ],
    [],
  )

  if (loading) return <Loading withOverlay={false} description="در حال بارگذاری..." />

  return (
    <div className="page">
      <h1 className="page-title">مشتریان VIP</h1>

      {settings && (
        <Tile className="vip-rules-tile">
          <p>
            VIP: بیش از <strong><Numeric>{formatNumber(settings.vipOrderThreshold)}</Numeric></strong> سفارش
            یا خرید بالای <strong><Numeric>{formatCurrency(settings.vipSpendingThreshold)}</Numeric></strong>
          </p>
          <Button kind="ghost" size="sm" onClick={() => navigate('/settings')}>
            تغییر آستانه
          </Button>
        </Tile>
      )}

      <AppDataTable
        data={customers}
        columns={columns}
        total={customers.length}
        page={1}
        pageSize={customers.length || 1}
        onPageChange={() => {}}
        emptyContent={
          <EmptyState
            title="هنوز مشتری VIP ندارید"
            description="با افزایش خرید یا تعداد سفارش، مشتریان به VIP ارتقا می‌یابند."
            actionLabel="تنظیم آستانه"
            onAction={() => navigate('/settings')}
          />
        }
      />
    </div>
  )
}
