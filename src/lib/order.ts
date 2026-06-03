import type { CashbackRule } from '../types/api'
import { calculateCashback } from './cashback'

export interface OrderSettlement {
  orderTotal: number
  discountAmount: number
  cashbackUsed: number
  payableAmount: number
  cashbackEarned: number
  remainingCashbackBalance: number
}

export function settleOrder(params: {
  orderTotal: number
  discountAmount?: number
  cashbackUsedRequested: number
  cashbackBalance: number
  rule: Pick<CashbackRule, 'percentage' | 'minimumAmount' | 'maximumAmount' | 'isActive'>
}): OrderSettlement {
  const orderTotal = params.orderTotal
  const discountAmount = Math.max(0, params.discountAmount ?? 0)
  const requested = Math.max(0, params.cashbackUsedRequested)

  if (orderTotal <= 0) {
    throw new Error('مبلغ فاکتور باید بیشتر از صفر باشد')
  }
  if (discountAmount > orderTotal) {
    throw new Error('مبلغ تخفیف بیشتر از مبلغ سفارش است')
  }
  if (requested > params.cashbackBalance) {
    throw new Error(
      `موجودی کش‌بک کافی نیست (موجودی: ${new Intl.NumberFormat('fa-IR').format(Math.round(params.cashbackBalance))} تومان)`,
    )
  }

  const afterDiscount = orderTotal - discountAmount
  if (requested > afterDiscount) {
    throw new Error('مبلغ کش‌بک مصرفی بیشتر از مبلغ قابل پرداخت است')
  }

  const cashbackUsed = requested
  const payableAmount = Math.max(0, afterDiscount - cashbackUsed)
  const cashbackEarned = calculateCashback(payableAmount, params.rule)
  const remainingCashbackBalance = params.cashbackBalance - cashbackUsed + cashbackEarned

  if (remainingCashbackBalance < 0) {
    throw new Error('خطا در محاسبه موجودی کش‌بک')
  }

  return {
    orderTotal,
    discountAmount,
    cashbackUsed,
    payableAmount,
    cashbackEarned,
    remainingCashbackBalance,
  }
}

/** Client-side preview; returns null when inputs are incomplete or invalid. */
export function previewOrderSettlement(params: {
  orderTotal: number
  discountAmount?: number
  cashbackUsedRequested: number
  cashbackBalance: number
  rule: Pick<CashbackRule, 'percentage' | 'minimumAmount' | 'maximumAmount' | 'isActive'> | null
}): OrderSettlement | null {
  if (!params.rule || params.orderTotal <= 0) return null
  try {
    return settleOrder({
      orderTotal: params.orderTotal,
      discountAmount: params.discountAmount,
      cashbackUsedRequested: params.cashbackUsedRequested,
      cashbackBalance: params.cashbackBalance,
      rule: params.rule,
    })
  } catch {
    return null
  }
}
