import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Button, Select, SelectItem, TextInput } from '@carbon/react'
import { Download } from '@carbon/icons-react'
import { createColumnHelper } from '@tanstack/react-table'
import { toast } from 'sonner'
import { AppDataTable } from '../components/AppDataTable'
import { EmptyState } from '../components/EmptyState'
import { Numeric } from '../components/Numeric'
import type { Customer, Transaction } from '../types/api'
import { formatCurrency, formatDate, downloadFile } from '../lib/format'

const columnHelper = createColumnHelper<Transaction>()

export function TransactionsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.customers.list({ pageSize: 500, sortBy: 'fullName', sortOrder: 'asc' }).then((r) => {
      setCustomers(r.data)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setLoading(true)
    window.api.transactions
      .list({
        search: debouncedSearch,
        customerId: customerId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo ? `${dateTo}T23:59:59` : undefined,
        page,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      .then((result) => {
        setData(result.data)
        setTotal(result.total)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, customerId, dateFrom, dateTo, page])

  const handleExport = async () => {
    try {
      const csv = await window.api.transactions.exportCsv()
      downloadFile('\uFEFF' + csv, `transactions-${Date.now()}.csv`, 'text/csv;charset=utf-8')
      toast.success('فایل با موفقیت دانلود شد')
    } catch {
      toast.error('خطا در خروجی گرفتن')
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor('createdAt', {
        header: 'تاریخ',
        cell: (info) => formatDate(info.getValue()),
      }),
      columnHelper.accessor('customer.fullName', {
        header: 'مشتری',
        cell: (info) => info.getValue() || '-',
      }),
      columnHelper.accessor('amount', {
        header: 'مبلغ',
        cell: (info) => <Numeric>{formatCurrency(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('cashbackEarned', {
        header: 'کش‌بک دریافتی',
        cell: (info) => <Numeric className="cashback">{formatCurrency(info.getValue())}</Numeric>,
      }),
      columnHelper.accessor('cashbackUsed', {
        header: 'کش‌بک مصرفی',
        cell: (info) => <Numeric>{formatCurrency(info.getValue())}</Numeric>,
      }),
    ],
    [],
  )

  return (
    <div className="page">
      <div className="page-header-row">
        <h1 className="page-title">تراکنش‌ها</h1>
        <Button kind="secondary" renderIcon={Download} onClick={handleExport}>
          خروجی CSV
        </Button>
      </div>

      <div className="filters-row">
        <Search
          id="tx-search"
          labelText="جستجو"
          placeholder="جستجو بر اساس نام یا موبایل..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          size="lg"
        />
        <TextInput
          id="date-from"
          labelText="از تاریخ"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value)
            setPage(1)
          }}
        />
        <TextInput
          id="date-to"
          labelText="تا تاریخ"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value)
            setPage(1)
          }}
        />
        <Select
          id="tx-customer"
          labelText="مشتری"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value)
            setPage(1)
          }}
        >
          <SelectItem value="" text="همه مشتریان" />
          {customers.map((c) => (
            <SelectItem key={c.id} value={c.id} text={c.fullName || c.phone} />
          ))}
        </Select>
      </div>

      <AppDataTable
        data={data}
        columns={columns}
        total={total}
        page={page}
        pageSize={20}
        onPageChange={setPage}
        isLoading={loading}
        emptyContent={
          !debouncedSearch && !dateFrom && !dateTo && !customerId ? (
            <EmptyState
              title="اولین تراکنش را ثبت کنید"
              description="از صندوق فروش یک خرید ثبت کنید تا اینجا نمایش داده شود."
              actionLabel="رفتن به صندوق"
              onAction={() => navigate('/pos')}
            />
          ) : (
            <span className="empty-state__desc">موردی یافت نشد</span>
          )
        }
      />
    </div>
  )
}
