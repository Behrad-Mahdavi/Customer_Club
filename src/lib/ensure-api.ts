import type {
  CashbackRule,
  ChartDataPoint,
  CreateTransactionInput,
  Customer,
  CustomerListParams,
  CustomerProfile,
  DashboardStats,
  ElectronAPI,
  PaginatedResult,
  Settings,
  Transaction,
  TransactionListParams,
  UpdateCustomerInput,
  VipCustomer,
} from '../types/api'
import { normalizePin, normalizePhone, parseAsciiDigits } from './normalize'

const KEYS = {
  settings: 'cc_settings',
  customers: 'cc_customers',
  transactions: 'cc_transactions',
  cashback: 'cc_cashback',
} as const

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, data: T): void {
  localStorage.setItem(key, JSON.stringify(data))
}

function uid(): string {
  return crypto.randomUUID()
}

function defaultSettings(): Settings {
  return {
    id: 'default',
    businessName: 'باشگاه مشتریان',
    branchName: 'شعبه اصلی',
    vipOrderThreshold: 10,
    vipSpendingThreshold: 5_000_000,
    authPin: '1234',
  }
}

function defaultCashback(): CashbackRule {
  return {
    id: uid(),
    percentage: 5,
    minimumAmount: 0,
    maximumAmount: 500_000,
    isActive: true,
  }
}

function isVip(customer: Customer, settings: Settings): boolean {
  return (
    customer.totalOrders >= settings.vipOrderThreshold ||
    customer.totalSpent >= settings.vipSpendingThreshold
  )
}

function getSettings(): Settings {
  const stored = load<Settings | null>(KEYS.settings, null)
  if (!stored) {
    const defaults = defaultSettings()
    save(KEYS.settings, defaults)
    return defaults
  }
  if (!stored.authPin) {
    stored.authPin = '1234'
    save(KEYS.settings, stored)
  }
  return stored
}

function getCustomers(): Customer[] {
  return load<Customer[]>(KEYS.customers, [])
}

function getTransactions(): Transaction[] {
  return load<Transaction[]>(KEYS.transactions, [])
}

function getCashbackRule(): CashbackRule {
  const rule = load<CashbackRule | null>(KEYS.cashback, null)
  if (!rule) {
    const defaults = defaultCashback()
    save(KEYS.cashback, defaults)
    return defaults
  }
  return rule
}

export function createDevApi(): ElectronAPI {
  console.warn(
    '[Customer Club] Running with browser mock API. Open the Electron window for full offline SQLite support.',
  )

  return {
    dashboard: {
      async getStats(): Promise<DashboardStats> {
        const customers = getCustomers()
        const transactions = getTransactions()
        const settings = getSettings()
        const vipCustomers = customers.filter((c) => isVip(c, settings)).length
        const returningCustomers = customers.filter((c) => c.totalOrders > 1).length
        const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0)

        return {
          totalCustomers: customers.length,
          vipCustomers,
          totalTransactions: transactions.length,
          totalRevenue,
          cashbackGenerated: transactions.reduce((sum, t) => sum + t.cashbackEarned, 0),
          cashbackConsumed: transactions.reduce((sum, t) => sum + t.cashbackUsed, 0),
          averageOrderValue: transactions.length ? totalRevenue / transactions.length : 0,
          returningCustomerRate: customers.length
            ? (returningCustomers / customers.length) * 100
            : 0,
        }
      },

      async getChartData(days = 30): Promise<ChartDataPoint[]> {
        const since = Date.now() - days * 86400000
        const grouped = new Map<string, { revenue: number; transactions: number; cashback: number }>()

        for (const tx of getTransactions()) {
          if (new Date(tx.createdAt).getTime() < since) continue
          const date = tx.createdAt.split('T')[0]
          const entry = grouped.get(date) ?? { revenue: 0, transactions: 0, cashback: 0 }
          entry.revenue += tx.amount
          entry.transactions += 1
          entry.cashback += tx.cashbackEarned
          grouped.set(date, entry)
        }

        return Array.from(grouped.entries()).map(([date, data]) => ({ date, ...data }))
      },

      async getTopCustomers(limit = 5): Promise<Customer[]> {
        const settings = getSettings()
        return getCustomers()
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .slice(0, limit)
          .map((c) => ({ ...c, isVip: isVip(c, settings) }))
      },

      async getRecentTransactions(limit = 8): Promise<Transaction[]> {
        const customers = getCustomers()
        return getTransactions()
          .slice(0, limit)
          .map((t) => ({
            ...t,
            customer: customers.find((c) => c.id === t.customerId)
              ? {
                  id: t.customerId,
                  fullName: customers.find((c) => c.id === t.customerId)!.fullName,
                  phone: customers.find((c) => c.id === t.customerId)!.phone,
                }
              : undefined,
          }))
      },
    },

    customers: {
      async lookup(phone: string): Promise<Customer | null> {
        const normalized = normalizePhone(phone)
        const settings = getSettings()
        const customer = getCustomers().find((c) => c.phone === normalized) ?? null
        return customer ? { ...customer, isVip: isVip(customer, settings) } : null
      },

      async list(params: CustomerListParams = {}): Promise<PaginatedResult<Customer>> {
        const settings = getSettings()
        const {
          search = '',
          vipOnly = false,
          sortBy = 'createdAt',
          sortOrder = 'desc',
          page = 1,
          pageSize = 20,
        } = params
        let customers = getCustomers()

        if (search) {
          const q = search.toLowerCase()
          customers = customers.filter(
            (c) => c.fullName.toLowerCase().includes(q) || c.phone.includes(parseAsciiDigits(search)),
          )
        }

        if (vipOnly) {
          customers = customers.filter((c) => isVip(c, settings))
        }

        customers.sort((a, b) => {
          const getVal = (c: Customer): number | string => {
            if (sortBy === 'lastPurchaseAt') {
              return c.lastPurchaseAt ? new Date(c.lastPurchaseAt).getTime() : 0
            }
            const val = c[sortBy as keyof Customer]
            if (typeof val === 'number') return val
            if (typeof val === 'string') return new Date(val).getTime()
            return 0
          }
          const av = getVal(a)
          const bv = getVal(b)
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return sortOrder === 'asc' ? cmp : -cmp
        })

        const start = (page - 1) * pageSize

        return {
          data: customers.slice(start, start + pageSize).map((c) => ({ ...c, isVip: isVip(c, settings) })),
          total: customers.length,
          page,
          pageSize,
        }
      },

      async get(id: string): Promise<CustomerProfile> {
        const settings = getSettings()
        const customer = getCustomers().find((c) => c.id === id)
        if (!customer) throw new Error('مشتری یافت نشد')

        const transactions = getTransactions()
          .filter((t) => t.customerId === id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return {
          ...customer,
          isVip: isVip(customer, settings),
          averageOrderValue: customer.totalOrders ? customer.totalSpent / customer.totalOrders : 0,
          cashbackEarned: transactions.reduce((sum, t) => sum + t.cashbackEarned, 0),
          cashbackUsed: transactions.reduce((sum, t) => sum + t.cashbackUsed, 0),
          transactions,
        }
      },

      async update(id: string, data: UpdateCustomerInput): Promise<Customer> {
        const settings = getSettings()
        const customers = getCustomers()
        const index = customers.findIndex((c) => c.id === id)
        if (index === -1) throw new Error('مشتری یافت نشد')

        const updated: Customer = {
          ...customers[index],
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.phone !== undefined ? { phone: normalizePhone(data.phone) } : {}),
          updatedAt: new Date().toISOString(),
        }
        customers[index] = updated
        save(KEYS.customers, customers)
        return { ...updated, isVip: isVip(updated, settings) }
      },

      async getVip(): Promise<VipCustomer[]> {
        const settings = getSettings()
        return getCustomers()
          .filter((c) => isVip(c, settings))
          .sort((a, b) => b.totalSpent - a.totalSpent || b.totalOrders - a.totalOrders)
          .map((c, index) => ({ ...c, rank: index + 1, isVip: true }))
      },

      async exportCsv(): Promise<string> {
        const settings = getSettings()
        const header = 'نام,موبایل,سفارش‌ها,مجموع خرید,کش‌بک,آخرین خرید,VIP'
        const rows = getCustomers()
          .sort((a, b) => b.totalSpent - a.totalSpent)
          .map((c) =>
            [
              c.fullName || '-',
              c.phone,
              c.totalOrders,
              c.totalSpent,
              c.cashbackBalance,
              c.lastPurchaseAt || '-',
              isVip(c, settings) ? 'بله' : 'خیر',
            ].join(','),
          )
        return [header, ...rows].join('\n')
      },
    },

    transactions: {
      async create(input: CreateTransactionInput) {
        const normalized = normalizePhone(input.phone)
        if (normalized.length < 10) throw new Error('شماره موبایل نامعتبر است')
        if (input.amount <= 0) throw new Error('مبلغ فاکتور باید بیشتر از صفر باشد')

        const rule = getCashbackRule()
        const settings = getSettings()
        const customers = getCustomers()
        let customer = customers.find((c) => c.phone === normalized)

        if (!customer) {
          customer = {
            id: uid(),
            fullName: input.fullName?.trim() || '',
            phone: normalized,
            cashbackBalance: 0,
            totalSpent: 0,
            totalOrders: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          customers.push(customer)
        } else if (input.fullName?.trim() && !customer.fullName) {
          customer.fullName = input.fullName.trim()
        }

        const cashbackUsed = Math.min(input.cashbackUsed ?? 0, customer.cashbackBalance, input.amount)
        let cashbackEarned = 0
        if (rule.isActive && input.amount >= rule.minimumAmount) {
          cashbackEarned = (input.amount * rule.percentage) / 100
          if (rule.maximumAmount > 0) cashbackEarned = Math.min(cashbackEarned, rule.maximumAmount)
        }

        customer.cashbackBalance = customer.cashbackBalance - cashbackUsed + cashbackEarned
        customer.totalSpent += input.amount
        customer.totalOrders += 1
        customer.updatedAt = new Date().toISOString()
        customer.lastPurchaseAt = new Date().toISOString()
        save(KEYS.customers, customers)

        const transaction: Transaction = {
          id: uid(),
          customerId: customer.id,
          amount: input.amount,
          cashbackEarned,
          cashbackUsed,
          finalAmount: input.amount - cashbackUsed,
          createdAt: new Date().toISOString(),
        }

        const transactions = getTransactions()
        transactions.unshift(transaction)
        save(KEYS.transactions, transactions)

        return {
          customer: { ...customer, isVip: isVip(customer, settings) },
          transaction,
        }
      },

      async list(params: TransactionListParams = {}): Promise<PaginatedResult<Transaction>> {
        const {
          search = '',
          customerId,
          dateFrom,
          dateTo,
          sortBy = 'createdAt',
          sortOrder = 'desc',
          page = 1,
          pageSize = 20,
        } = params
        const customers = getCustomers()
        let transactions = getTransactions().map((t) => ({
          ...t,
          customer: customers.find((c) => c.id === t.customerId),
        }))

        if (customerId) {
          transactions = transactions.filter((t) => t.customerId === customerId)
        }

        if (search) {
          const q = search.toLowerCase()
          transactions = transactions.filter(
            (t) =>
              t.customer?.fullName.toLowerCase().includes(q) ||
              t.customer?.phone.includes(parseAsciiDigits(search)),
          )
        }

        if (dateFrom) {
          const from = new Date(dateFrom).getTime()
          transactions = transactions.filter((t) => new Date(t.createdAt).getTime() >= from)
        }
        if (dateTo) {
          const to = new Date(dateTo).getTime()
          transactions = transactions.filter((t) => new Date(t.createdAt).getTime() <= to)
        }

        transactions.sort((a, b) => {
          const av = a[sortBy as keyof Transaction] as number | string
          const bv = b[sortBy as keyof Transaction] as number | string
          const cmp = av < bv ? -1 : av > bv ? 1 : 0
          return sortOrder === 'asc' ? cmp : -cmp
        })

        const start = (page - 1) * pageSize
        return {
          data: transactions.slice(start, start + pageSize).map((t) => ({
            ...t,
            customer: t.customer
              ? { id: t.customer.id, fullName: t.customer.fullName, phone: t.customer.phone }
              : undefined,
          })),
          total: transactions.length,
          page,
          pageSize,
        }
      },

      async exportCsv(): Promise<string> {
        const customers = getCustomers()
        const header = 'شناسه,مشتری,موبایل,مبلغ,کش‌بک دریافتی,کش‌بک مصرفی,مبلغ نهایی,تاریخ'
        const rows = getTransactions().map((t) => {
          const c = customers.find((x) => x.id === t.customerId)
          return [t.id, c?.fullName || '-', c?.phone || '-', t.amount, t.cashbackEarned, t.cashbackUsed, t.finalAmount, t.createdAt].join(',')
        })
        return [header, ...rows].join('\n')
      },
    },

    cashback: {
      async getRule(): Promise<CashbackRule> {
        return getCashbackRule()
      },
      async updateRule(data): Promise<CashbackRule> {
        const updated = { ...getCashbackRule(), ...data }
        save(KEYS.cashback, updated)
        return updated
      },
    },

    settings: {
      async get(): Promise<Settings> {
        return getSettings()
      },
      async update(data): Promise<Settings> {
        const updated = { ...getSettings(), ...data }
        save(KEYS.settings, updated)
        return updated
      },
      async verifyPin(pin: string): Promise<boolean> {
        return normalizePin(getSettings().authPin) === normalizePin(pin)
      },
    },

    database: {
      async export(): Promise<string> {
        return JSON.stringify(
          {
            settings: getSettings(),
            customers: getCustomers(),
            transactions: getTransactions(),
            cashbackRules: [getCashbackRule()],
          },
          null,
          2,
        )
      },
      async import(jsonData: string): Promise<void> {
        const data = JSON.parse(jsonData) as {
          settings?: Settings
          customers?: Customer[]
          transactions?: Transaction[]
          cashbackRules?: CashbackRule[]
        }
        if (data.settings) save(KEYS.settings, data.settings)
        if (data.customers) save(KEYS.customers, data.customers)
        if (data.transactions) save(KEYS.transactions, data.transactions)
        if (data.cashbackRules?.[0]) save(KEYS.cashback, data.cashbackRules[0])
      },
      async backup(): Promise<string> {
        return 'browser-dev-mode'
      },
    },
  }
}

export function ensureApi(): void {
  if (!window.api) {
    window.api = createDevApi()
  }
}
