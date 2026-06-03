import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Button,
  TextInput,
  Tile,
  Tag,
  Loading,
  Grid,
  Column,
} from '@carbon/react'
import { ArrowLeft } from '@carbon/icons-react'
import { toast } from 'sonner'
import { AppDataTable } from '../components/AppDataTable'
import type { ColumnDef } from '@tanstack/react-table'
import type { CustomerProfile, Transaction } from '../types/api'
import { formatCurrency, formatDate } from '../lib/format'

const transactionColumns: ColumnDef<Transaction, unknown>[] = [
  {
    accessorKey: 'amount',
    header: 'مبلغ',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
  },
  {
    accessorKey: 'cashbackEarned',
    header: 'کش‌بک دریافتی',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
  },
  {
    accessorKey: 'cashbackUsed',
    header: 'کش‌بک مصرفی',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
  },
  {
    accessorKey: 'finalAmount',
    header: 'مبلغ نهایی',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
  },
  {
    accessorKey: 'createdAt',
    header: 'تاریخ',
    cell: ({ getValue }) => formatDate(getValue<string>()),
  },
]

export function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    window.api.customers.get(id).then((p) => {
      setProfile(p)
      setFullName(p.fullName)
      setPhone(p.phone)
    })
  }, [id])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      const updated = await window.api.customers.update(id, { fullName, phone })
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      toast.success('اطلاعات ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره اطلاعات')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <Loading withOverlay={false} description="در حال بارگذاری..." />

  return (
    <div className="page">
      <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/customers')}>
        بازگشت
      </Button>
      <div className="profile-header">
        <h1 className="page-title">{profile.fullName || 'مشتری'}</h1>
        {profile.isVip && <Tag type="purple">VIP</Tag>}
      </div>

      <Grid narrow>
        <Column lg={8} md={4} sm={4}>
          <Tile>
            <h3>اطلاعات عمومی</h3>
            <TextInput id="name" labelText="نام" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <TextInput id="phone" labelText="موبایل" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="field-info">تاریخ ثبت‌نام: {formatDate(profile.createdAt)}</p>
            <Button kind="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
          </Tile>
        </Column>
        <Column lg={8} md={4} sm={4}>
          <Tile>
            <h3>آمار</h3>
            <div className="profile-stats">
              <div><span>کل سفارش‌ها</span><strong>{profile.totalOrders}</strong></div>
              <div><span>مجموع خرید</span><strong>{formatCurrency(profile.totalSpent)}</strong></div>
              <div><span>میانگین سفارش</span><strong>{formatCurrency(profile.averageOrderValue)}</strong></div>
              <div><span>کش‌بک دریافتی</span><strong>{formatCurrency(profile.cashbackEarned)}</strong></div>
              <div><span>کش‌بک مصرفی</span><strong>{formatCurrency(profile.cashbackUsed)}</strong></div>
              <div><span>موجودی کش‌بک</span><strong className="cashback">{formatCurrency(profile.cashbackBalance)}</strong></div>
              <div><span>آخرین خرید</span><strong>{profile.lastPurchaseAt ? formatDate(profile.lastPurchaseAt) : '-'}</strong></div>
            </div>
          </Tile>
        </Column>
      </Grid>

      <h2 className="section-title">تاریخچه خرید</h2>
      <AppDataTable
        data={profile.transactions}
        columns={transactionColumns}
        total={profile.transactions.length}
        page={1}
        pageSize={profile.transactions.length || 1}
        onPageChange={() => {}}
      />
    </div>
  )
}
