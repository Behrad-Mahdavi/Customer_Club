import { useEffect, useState } from 'react'
import {
  Button,
  TextInput,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Tag,
  Loading,
} from '@carbon/react'
import { Close } from '@carbon/icons-react'
import { toast } from 'sonner'
import type { CustomerProfile } from '../types/api'
import { formatCurrency, formatDate, formatNumber, formatPhone } from '../lib/format'
import { sanitizePhoneInput } from '../lib/normalize'
import { Numeric } from './Numeric'

interface Props {
  customerId: string | null
  onClose: () => void
}

export function CustomerDetailDrawer({ customerId, onClose }: Props) {
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerId) {
      setProfile(null)
      return
    }
    setLoading(true)
    window.api.customers
      .get(customerId)
      .then((p) => {
        setProfile(p)
        setFullName(p.fullName)
        setPhone(p.phone)
      })
      .finally(() => setLoading(false))
  }, [customerId])

  if (!customerId) return null

  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)
    try {
      const updated = await window.api.customers.update(customerId, { fullName, phone })
      setProfile((prev) => (prev ? { ...prev, ...updated } : prev))
      toast.success('اطلاعات مشتری ذخیره شد')
    } catch {
      toast.error('خطا در ذخیره')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside className="customer-drawer" role="dialog" aria-label="جزئیات مشتری">
        <header className="drawer-header">
          <h2>{profile?.fullName || 'مشتری'}</h2>
          <Button kind="ghost" size="sm" hasIconOnly renderIcon={Close} iconDescription="بستن" onClick={onClose} />
        </header>

        {loading || !profile ? (
          <Loading withOverlay={false} description="در حال بارگذاری..." />
        ) : (
          <>
            <div className="drawer-summary">
              {profile.isVip && <Tag type="purple">VIP</Tag>}
              <p><Numeric>{formatPhone(profile.phone)}</Numeric></p>
              <div className="drawer-summary-stats">
                <div><span>سفارش‌ها</span><strong><Numeric>{formatNumber(profile.totalOrders)}</Numeric></strong></div>
                <div><span>مجموع خرید</span><strong><Numeric>{formatCurrency(profile.totalSpent)}</Numeric></strong></div>
                <div><span>کش‌بک</span><strong className="cashback"><Numeric>{formatCurrency(profile.cashbackBalance)}</Numeric></strong></div>
              </div>
            </div>

            <Tabs>
              <TabList aria-label="تب‌های مشتری">
                <Tab>خلاصه</Tab>
                <Tab>تراکنش‌ها</Tab>
                <Tab>کش‌بک</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <div className="drawer-form">
                    <TextInput id="drawer-name" labelText="نام" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    <TextInput id="drawer-phone" labelText="موبایل" value={phone} onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))} className="numeric" />
                    <p className="field-info">ثبت‌نام: {formatDate(profile.createdAt)}</p>
                    <p className="field-info">میانگین سفارش: <Numeric>{formatCurrency(profile.averageOrderValue)}</Numeric></p>
                    <Button kind="primary" onClick={handleSave} disabled={saving}>
                      {saving ? 'در حال ذخیره...' : 'ذخیره'}
                    </Button>
                  </div>
                </TabPanel>
                <TabPanel>
                  <ul className="drawer-list">
                    {profile.transactions.length === 0 ? (
                      <li className="drawer-list-empty">تراکنشی ثبت نشده</li>
                    ) : (
                      profile.transactions.map((tx) => (
                        <li key={tx.id}>
                          <span>{formatDate(tx.createdAt)}</span>
                          <strong><Numeric>{formatCurrency(tx.amount)}</Numeric></strong>
                          <span className="cashback">+<Numeric>{formatCurrency(tx.cashbackEarned)}</Numeric></span>
                        </li>
                      ))
                    )}
                  </ul>
                </TabPanel>
                <TabPanel>
                  <div className="drawer-cashback-stats">
                    <div><span>دریافتی</span><strong><Numeric>{formatCurrency(profile.cashbackEarned)}</Numeric></strong></div>
                    <div><span>مصرفی</span><strong><Numeric>{formatCurrency(profile.cashbackUsed)}</Numeric></strong></div>
                    <div><span>موجودی</span><strong className="cashback"><Numeric>{formatCurrency(profile.cashbackBalance)}</Numeric></strong></div>
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </>
        )}
      </aside>
    </>
  )
}
