import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TextInput, Button, Tag, SkeletonText, SkeletonPlaceholder } from '@carbon/react'
import { CheckmarkFilled, UserFollow, ArrowLeft } from '@carbon/icons-react'
import { toast } from 'sonner'
import type { CashbackRule, Customer } from '../types/api'
import { settleOrder, previewOrderSettlement } from '../lib/order'
import {
  formatCurrency,
  formatNumber,
  formatPhone,
  formatRelativeDate,
} from '../lib/format'
import { normalizePhone, sanitizePhoneInput } from '../lib/normalize'
import { Numeric } from '../components/Numeric'
import { MoneyInput } from '../components/MoneyInput'
import { usePosHotkeys } from '../hooks/usePosHotkeys'

type Step = 'phone' | 'purchase' | 'success'

interface SuccessSummary {
  orderTotal: number
  payableAmount: number
  cashbackUsed: number
  earned: number
  remainingBalance: number
}

export function POSPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const phoneRef = useRef<HTMLInputElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const [phone, setPhone] = useState('')
  const [fullName, setFullName] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [cashbackUsedStr, setCashbackUsedStr] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cashbackRule, setCashbackRule] = useState<CashbackRule | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [step, setStep] = useState<Step>('phone')
  const [lastResult, setLastResult] = useState<SuccessSummary | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setPhone('')
    setFullName('')
    setAmountStr('')
    setCashbackUsedStr('')
    setCustomer(null)
    setIsNew(false)
    setStep('phone')
    setLastResult(null)
    setPreviewError(null)
    setTimeout(() => phoneRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    phoneRef.current?.focus()
    window.api.cashback.getRule().then(setCashbackRule).catch(() => {})
  }, [])

  useEffect(() => {
    const state = location.state as { newPurchase?: boolean } | null
    if (state?.newPurchase) {
      reset()
      navigate('/pos', { replace: true, state: {} })
    }
  }, [location.state, navigate, reset])

  useEffect(() => {
    if (step === 'success' && lastResult) {
      const timer = setTimeout(reset, 2000)
      return () => clearTimeout(timer)
    }
  }, [step, lastResult, reset])

  useEffect(() => {
    if (step === 'purchase') {
      setTimeout(() => {
        if (isNew) nameRef.current?.focus()
        else amountRef.current?.focus()
      }, 50)
    }
  }, [step, isNew])

  const focusSearch = useCallback(() => {
    reset()
  }, [reset])

  const newPurchase = useCallback(() => {
    if (step === 'purchase') {
      setAmountStr('')
      setCashbackUsedStr('')
      setPreviewError(null)
      setTimeout(() => amountRef.current?.focus(), 50)
    } else {
      reset()
    }
  }, [step, reset])

  const goBack = useCallback(() => {
    if (step === 'phone') {
      navigate('/')
    } else {
      reset()
    }
  }, [step, navigate, reset])

  usePosHotkeys({ focusSearch, newPurchase, goBack })

  const amount = Number(amountStr) || 0
  const cashbackUsed = Number(cashbackUsedStr) || 0
  const cashbackBalance = customer?.cashbackBalance ?? 0

  const settlementPreview = useMemo(() => {
    if (!cashbackRule || amount <= 0) {
      return null
    }
    return previewOrderSettlement({
      orderTotal: amount,
      cashbackUsedRequested: cashbackUsed,
      cashbackBalance: isNew ? 0 : cashbackBalance,
      rule: cashbackRule,
    })
  }, [amount, cashbackUsed, cashbackBalance, cashbackRule, isNew])

  useEffect(() => {
    if (amount <= 0 || !customer || isNew) {
      setPreviewError(null)
      return
    }
    if (cashbackUsed <= 0) {
      setPreviewError(null)
      return
    }
    try {
      settleOrder({
        orderTotal: amount,
        cashbackUsedRequested: cashbackUsed,
        cashbackBalance,
        rule: cashbackRule!,
      })
      setPreviewError(null)
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'مبلغ کش‌بک نامعتبر است')
    }
  }, [amount, cashbackUsed, cashbackBalance, customer, isNew, cashbackRule])

  const maxCashbackUsable = Math.max(0, Math.min(cashbackBalance, amount))

  const handlePhoneSubmit = async () => {
    const normalized = normalizePhone(phone)
    if (normalized.length < 10) {
      toast.error('شماره موبایل نامعتبر است')
      phoneRef.current?.focus()
      return
    }

    setLookupLoading(true)
    try {
      const found = await window.api.customers.lookup(normalized)
      if (found) {
        setCustomer(found)
        setIsNew(false)
        setFullName(found.fullName)
      } else {
        setCustomer(null)
        setIsNew(true)
        setFullName('')
      }
      setStep('purchase')
    } catch {
      toast.error('خطا در جستجوی مشتری')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleCreateAndContinue = () => {
    setTimeout(() => amountRef.current?.focus(), 50)
  }

  const handleRegister = async () => {
    if (amount <= 0) {
      toast.error('مبلغ خرید را وارد کنید')
      amountRef.current?.focus()
      return
    }

    if (!isNew && cashbackUsed > 0) {
      try {
        settleOrder({
          orderTotal: amount,
          cashbackUsedRequested: cashbackUsed,
          cashbackBalance,
          rule: cashbackRule!,
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'مبلغ کش‌بک نامعتبر است')
        return
      }
    }

    setRegisterLoading(true)
    try {
      const result = await window.api.transactions.create({
        phone: normalizePhone(phone),
        fullName: isNew ? fullName : undefined,
        amount,
        cashbackUsed: isNew ? 0 : cashbackUsed,
      })

      setCustomer(result.customer)
      setLastResult({
        orderTotal: result.orderTotal,
        payableAmount: result.payableAmount,
        cashbackUsed: result.cashbackUsed,
        earned: result.cashbackEarned,
        remainingBalance: result.remainingCashbackBalance,
      })
      setStep('success')
      toast.success('خرید ثبت شد')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'خطا در ثبت')
    } finally {
      setRegisterLoading(false)
    }
  }

  const onEnter = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      action()
    }
  }

  return (
    <div className="pos-screen page--pos">
      <header className="pos-screen-header">
        <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/')}>
          مدیریت
        </Button>
        <h1>صندوق فروش</h1>
        <span className="pos-kbd-hint">Enter = تأیید | Tab = بعدی</span>
      </header>

      <main className="pos-main">
        {step === 'phone' && (
          <>
            {lookupLoading ? (
              <div className="pos-lookup-skeleton" aria-busy="true" aria-label="در حال جستجو">
                <SkeletonText heading width="60%" />
                <SkeletonText paragraph lineCount={1} width="80%" />
                <SkeletonPlaceholder className="pos-lookup-skeleton__field" />
              </div>
            ) : (
              <div className="pos-lookup">
                <h2>شناسایی مشتری</h2>
                <p className="pos-hint">شماره موبایل را وارد کنید و Enter بزنید</p>
                <TextInput
                  ref={phoneRef}
                  id="pos-phone"
                  labelText="شماره موبایل"
                  placeholder="09123456789"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                  onKeyDown={(e) => onEnter(e, handlePhoneSubmit)}
                  size="lg"
                  inputMode="tel"
                  autoComplete="off"
                  className="pos-phone-input numeric"
                />
              </div>
            )}
          </>
        )}

        {step === 'purchase' && (
          <div className="pos-split">
            <div className="pos-panel pos-panel--info">
              {customer && !isNew ? (
                <>
                  <div className="pos-customer-header">
                    <h2>{customer.fullName || 'مشتری'}</h2>
                    {customer.isVip && <Tag type="purple">VIP</Tag>}
                  </div>
                  <p className="pos-phone-display">
                    <Numeric>{formatPhone(customer.phone)}</Numeric>
                  </p>
                  <dl className="pos-dl">
                    <div>
                      <dt>سفارش‌ها</dt>
                      <dd><Numeric>{formatNumber(customer.totalOrders)}</Numeric></dd>
                    </div>
                    <div>
                      <dt>مجموع خرید</dt>
                      <dd><Numeric>{formatCurrency(customer.totalSpent)}</Numeric></dd>
                    </div>
                    <div>
                      <dt>کش‌بک</dt>
                      <dd className="cashback"><Numeric>{formatCurrency(customer.cashbackBalance)}</Numeric></dd>
                    </div>
                    <div>
                      <dt>آخرین مراجعه</dt>
                      <dd>{formatRelativeDate(customer.lastPurchaseAt)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="pos-new-inline">
                  <div className="pos-customer-header">
                    <UserFollow size={24} />
                    <h2>مشتری یافت نشد</h2>
                  </div>
                  <p className="pos-hint">مشتری جدید ایجاد شود؟</p>
                  <TextInput
                    ref={nameRef}
                    id="pos-name"
                    labelText="نام"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onKeyDown={(e) => onEnter(e, handleCreateAndContinue)}
                    size="lg"
                  />
                  <TextInput
                    id="pos-phone-readonly"
                    labelText="موبایل"
                    value={formatPhone(normalizePhone(phone))}
                    readOnly
                    size="lg"
                    className="numeric"
                  />
                  <Button kind="tertiary" onClick={handleCreateAndContinue}>
                    ایجاد و ادامه
                  </Button>
                </div>
              )}
              <Button kind="ghost" className="pos-back-btn" onClick={reset}>
                مشتری دیگر
              </Button>
            </div>

            <div className="pos-panel pos-panel--purchase">
              <h2>ثبت خرید</h2>
              <MoneyInput
                ref={amountRef}
                id="pos-amount"
                labelText="مبلغ خرید"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onKeyDown={(e) => onEnter(e, handleRegister)}
                size="lg"
                inputMode="numeric"
                placeholder="0"
                className="pos-amount-input"
              />

              {customer && !isNew && customer.cashbackBalance > 0 && (
                <MoneyInput
                  id="pos-cashback-used"
                  labelText={`مصرف کش‌بک (حداکثر ${formatCurrency(maxCashbackUsable)})`}
                  value={cashbackUsedStr}
                  onChange={(e) => setCashbackUsedStr(e.target.value)}
                  onKeyDown={(e) => onEnter(e, handleRegister)}
                  size="lg"
                  inputMode="numeric"
                  placeholder="0"
                  invalid={!!previewError}
                  invalidText={previewError ?? undefined}
                />
              )}

              {settlementPreview && (
                <div className="pos-settlement-preview">
                  {cashbackUsed > 0 && (
                    <div className="pos-settlement-row">
                      <span>مبلغ قابل پرداخت</span>
                      <strong><Numeric>{formatCurrency(settlementPreview.payableAmount)}</Numeric></strong>
                    </div>
                  )}
                  <div className="pos-earned-live">
                    <span>کش‌بک این خرید</span>
                    <strong className="cashback">
                      <Numeric>{formatCurrency(settlementPreview.cashbackEarned)}</Numeric>
                    </strong>
                  </div>
                </div>
              )}

              <Button
                kind="primary"
                size="lg"
                className="pos-register-btn"
                onClick={handleRegister}
                disabled={registerLoading || (isNew && !fullName.trim()) || !!previewError}
              >
                {registerLoading ? 'در حال ثبت...' : 'ثبت خرید'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && lastResult && (
          <div className="pos-success-screen">
            <CheckmarkFilled size={64} className="success-icon" />
            <h2>خرید ثبت شد</h2>
            <dl className="pos-success-dl">
              <div>
                <dt>مبلغ سفارش</dt>
                <dd><Numeric>{formatCurrency(lastResult.orderTotal)}</Numeric></dd>
              </div>
              {lastResult.cashbackUsed > 0 && (
                <div>
                  <dt>کش‌بک مصرف‌شده</dt>
                  <dd><Numeric>{formatCurrency(lastResult.cashbackUsed)}</Numeric></dd>
                </div>
              )}
              <div>
                <dt>مبلغ پرداختی</dt>
                <dd><Numeric>{formatCurrency(lastResult.payableAmount)}</Numeric></dd>
              </div>
              <div>
                <dt>کش‌بک جدید</dt>
                <dd className="cashback"><Numeric>{formatCurrency(lastResult.earned)}</Numeric></dd>
              </div>
              <div>
                <dt>موجودی کش‌بک</dt>
                <dd className="cashback"><Numeric>{formatCurrency(lastResult.remainingBalance)}</Numeric></dd>
              </div>
            </dl>
            <p className="pos-hint">بازگشت خودکار به صفحه شناسایی...</p>
          </div>
        )}
      </main>

      <footer className="pos-shortcuts-bar" aria-label="میانبرهای صفحه‌کلید">
        <span><kbd>F1</kbd> جستجو</span>
        <span><kbd>F2</kbd> خرید جدید</span>
        <span><kbd>F3</kbd> مشتریان</span>
        <span><kbd>F4</kbd> VIP</span>
        <span><kbd>Esc</kbd> بازگشت</span>
      </footer>
    </div>
  )
}
