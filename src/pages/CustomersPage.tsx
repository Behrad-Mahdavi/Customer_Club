import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Tag, Button, Toggle } from '@carbon/react'
import { Download } from '@carbon/icons-react'
import { createColumnHelper } from '@tanstack/react-table'
import { toast } from 'sonner'
import { AppDataTable } from '../components/AppDataTable'
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer'
import { EmptyState } from '../components/EmptyState'
import { Numeric } from '../components/Numeric'
import type { Customer } from '../types/api'
import { formatCurrency, formatNumber, formatPhone, formatRelativeDate, downloadFile } from '../lib/format'

const columnHelper = createColumnHelper<Customer>()

export function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [vipOnly, setVipOnly] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [data, setData] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setLoading(true)
    window.api.customers
      .list({ search: debouncedSearch, page, pageSize: 20, sortBy: 'lastPurchaseAt', sortOrder: 'desc', vipOnly })
      .then((result) => {
        setData(result.data)
        setTotal(result.total)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, page, vipOnly])

  const handleExport = async () => {
    try {
      const csv = await window.api.customers.exportCsv()
      downloadFile('\uFEFF' + csv, `customers-${Date.now()}.csv`, 'text/csv;charset=utf-8')
      toast.success('لیست مشتریان دانلود شد')
    } catch {
      toast.error('خطا در خروجی')
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('fullName', {
        header: 'نام',
        cell: (info) => (
          <span className="table-link">
            {info.getValue() || '-'}
            {info.row.original.isVip && <Tag type="purple" size="sm">VIP</Tag>}
          </span>
        ),
      }),
      columnHelper.accessor('phone', {
        header: 'موبایل',
        cell: (info) => <Numeric>{formatPhone(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('totalOrders', {
        header: 'سفارش‌ها',
        cell: (info) => <Numeric>{formatNumber(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('totalSpent', {
        header: 'مجموع خرید',
        cell: (info) => <Numeric>{formatCurrency(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('cashbackBalance', {
        header: 'کش‌بک',
        cell: (info) => <Numeric className="cashback">{formatCurrency(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('lastPurchaseAt', {
        header: 'آخرین مراجعه',
        cell: (info) => formatRelativeDate(info.getValue()),
      }),
    ],
    [],
  )

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">مشتریان</h1>
        <div className="page-header-actions">
          <Button kind="ghost" onClick={() => setShowFilters((v) => !v)}>
            فیلتر
          </Button>
          <Button kind="secondary" renderIcon={Download} onClick={handleExport}>
            خروجی
          </Button>
        </div>
      </div>

      <Search
        id="customer-search"
        labelText="جستجو"
        placeholder="نام یا موبایل..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        size="lg"
      />

      {showFilters && (
        <div className="filters-row">
          <Toggle
            id="vip-filter"
            labelText="فقط VIP"
            labelA="خاموش"
            labelB="روشن"
            toggled={vipOnly}
            onToggle={(checked) => {
              setVipOnly(checked)
              setPage(1)
            }}
          />
        </div>
      )}

      <AppDataTable
        data={data}
        columns={columns}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        onRowClick={(row) => setSelectedId(row.id)}
        isLoading={loading}
        emptyContent={
          !debouncedSearch && !vipOnly ? (
            <EmptyState
              title="هیچ مشتری ثبت نشده است"
              description="اولین مشتری را از صندوق فروش ثبت کنید."
              actionLabel="رفتن به صندوق"
              onAction={() => navigate('/pos')}
            />
          ) : (
            <span className="empty-state__desc">موردی یافت نشد</span>
          )
        }
      />

      <CustomerDetailDrawer customerId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
