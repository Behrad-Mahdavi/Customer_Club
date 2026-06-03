import type { CashbackRule } from '../types/api'

export function calculateCashback(amount: number, rule: Pick<CashbackRule, 'percentage' | 'minimumAmount' | 'maximumAmount' | 'isActive'>): number {
  if (!rule.isActive || amount <= 0 || amount < rule.minimumAmount) return 0
  let earned = (amount * rule.percentage) / 100
  if (rule.maximumAmount > 0) earned = Math.min(earned, rule.maximumAmount)
  return earned
}

export function calculateMaxCashbackUse(
  balance: number,
  amount: number,
  requested: number,
): number {
  return Math.min(requested, balance, amount)
}
