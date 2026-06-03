import { ipcMain } from 'electron'
import { getPrisma, getDbPath } from './prisma'
import fs from 'node:fs'
import path from 'node:path'
import { settleOrder } from '../../src/lib/order'
import { normalizePin, normalizePhone } from '../../src/lib/normalize'
import { buildCustomerSearchOr } from '../../src/lib/search'
import type {
  Customer,
  CustomerListParams,
  CustomerProfile,
  CreateTransactionInput,
  CreateTransactionResult,
  DashboardStats,
  PaginatedResult,
  Settings,
  Transaction,
  TransactionListParams,
  UpdateCustomerInput,
  VipCustomer,
} from '../../src/types/api'

function serializeDate(date: Date): string {
  return date.toISOString()
}

async function getSettings() {
  const db = getPrisma()
  let settings = await db.settings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    settings = await db.settings.create({ data: { id: 'default' } })
  }
  if (!settings.authPin) {
    settings = await db.settings.update({
      where: { id: 'default' },
      data: { authPin: '1234' },
    })
  }
  return settings
}

function isVip(
  customer: { totalOrders: number; totalSpent: number },
  settings: { vipOrderThreshold: number; vipSpendingThreshold: number },
): boolean {
  return (
    customer.totalOrders >= settings.vipOrderThreshold ||
    customer.totalSpent >= settings.vipSpendingThreshold
  )
}

function toCustomer(
  customer: {
    id: string
    fullName: string
    phone: string
    cashbackBalance: number
    totalSpent: number
    totalOrders: number
    createdAt: Date
    updatedAt: Date
    lastPurchaseAt?: Date | null
  },
  vip?: boolean,
): Customer {
  return {
    ...customer,
    createdAt: serializeDate(customer.createdAt),
    updatedAt: serializeDate(customer.updatedAt),
    lastPurchaseAt: customer.lastPurchaseAt ? serializeDate(customer.lastPurchaseAt) : null,
    ...(vip !== undefined ? { isVip: vip } : {}),
  }
}

function toTransaction(
  tx: {
    id: string
    customerId: string
    amount: number
    cashbackEarned: number
    cashbackUsed: number
    finalAmount: number
    createdAt: Date
    customer?: { id: string; fullName: string; phone: string }
  },
): Transaction {
  return {
    id: tx.id,
    customerId: tx.customerId,
    amount: tx.amount,
    cashbackEarned: tx.cashbackEarned,
    cashbackUsed: tx.cashbackUsed,
    finalAmount: tx.finalAmount,
    createdAt: serializeDate(tx.createdAt),
    ...(tx.customer
      ? { customer: { id: tx.customer.id, fullName: tx.customer.fullName, phone: tx.customer.phone } }
      : {}),
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:getStats', async (): Promise<DashboardStats> => {
    const db = getPrisma()
    const settings = await getSettings()

    const [totalCustomers, totalTransactions, aggregates, returningCustomers] = await Promise.all([
      db.customer.count(),
      db.transaction.count(),
      db.transaction.aggregate({
        _sum: { amount: true, cashbackEarned: true, cashbackUsed: true },
        _avg: { amount: true },
      }),
      db.customer.count({ where: { totalOrders: { gt: 1 } } }),
    ])

    const allCustomers = await db.customer.findMany({
      select: { totalOrders: true, totalSpent: true },
    })
    const vipCustomers = allCustomers.filter((c) => isVip(c, settings)).length

    const totalRevenue = aggregates._sum.amount ?? 0
    const totalWithOrders = totalCustomers || 1

    return {
      totalCustomers,
      vipCustomers,
      totalTransactions,
      totalRevenue,
      cashbackGenerated: aggregates._sum.cashbackEarned ?? 0,
      cashbackConsumed: aggregates._sum.cashbackUsed ?? 0,
      averageOrderValue: aggregates._avg.amount ?? 0,
      returningCustomerRate: (returningCustomers / totalWithOrders) * 100,
    }
  })

  ipcMain.handle('dashboard:getChartData', async (_event, days = 30) => {
    const db = getPrisma()
    const since = new Date()
    since.setDate(since.getDate() - days)

    const transactions = await db.transaction.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    })

    const grouped = new Map<string, { revenue: number; transactions: number; cashback: number }>()
    for (const tx of transactions) {
      const date = tx.createdAt.toISOString().split('T')[0]
      const existing = grouped.get(date) ?? { revenue: 0, transactions: 0, cashback: 0 }
      existing.revenue += tx.amount
      existing.transactions += 1
      existing.cashback += tx.cashbackEarned
      grouped.set(date, existing)
    }

    return Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      transactions: data.transactions,
      cashback: data.cashback,
    }))
  })

  ipcMain.handle('dashboard:getTopCustomers', async (_event, limit = 5): Promise<Customer[]> => {
    const db = getPrisma()
    const settings = await getSettings()
    const customers = await db.customer.findMany({
      orderBy: { totalSpent: 'desc' },
      take: limit,
    })
    return customers.map((c) => toCustomer(c, isVip(c, settings)))
  })

  ipcMain.handle('dashboard:getRecentTransactions', async (_event, limit = 8): Promise<Transaction[]> => {
    const db = getPrisma()
    const transactions = await db.transaction.findMany({
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return transactions.map((t) => toTransaction(t))
  })

  ipcMain.handle('customers:lookup', async (_event, phone: string): Promise<Customer | null> => {
    const db = getPrisma()
    const settings = await getSettings()
    const normalized = normalizePhone(phone)

    const customer = await db.customer.findUnique({ where: { phone: normalized } })
    if (!customer) return null

    return toCustomer(customer, isVip(customer, settings))
  })

  ipcMain.handle(
    'customers:list',
    async (_event, params: CustomerListParams = {}): Promise<PaginatedResult<Customer>> => {
      const db = getPrisma()
      const settings = await getSettings()
      const {
        search = '',
        vipOnly = false,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 20,
      } = params

      const andConditions: Record<string, unknown>[] = []

      if (search) {
        const searchOr = buildCustomerSearchOr(search)
        if (searchOr.length > 0) {
          andConditions.push({ OR: searchOr })
        }
      }

      if (vipOnly) {
        andConditions.push({
          OR: [
            { totalOrders: { gte: settings.vipOrderThreshold } },
            { totalSpent: { gte: settings.vipSpendingThreshold } },
          ],
        })
      }

      const where = andConditions.length > 0 ? { AND: andConditions } : {}

      const [total, customers] = await Promise.all([
        db.customer.count({ where }),
        db.customer.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])

      return {
        data: customers.map((c) => toCustomer(c, isVip(c, settings))),
        total,
        page,
        pageSize,
      }
    },
  )

  ipcMain.handle('customers:get', async (_event, id: string): Promise<CustomerProfile> => {
    const db = getPrisma()
    const settings = await getSettings()

    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: 'desc' } },
      },
    })

    if (!customer) throw new Error('مشتری یافت نشد')

    const cashbackEarned = customer.transactions.reduce((sum, t) => sum + t.cashbackEarned, 0)
    const cashbackUsed = customer.transactions.reduce((sum, t) => sum + t.cashbackUsed, 0)

    return {
      ...toCustomer(customer, isVip(customer, settings)),
      averageOrderValue: customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0,
      cashbackEarned,
      cashbackUsed,
      transactions: customer.transactions.map((t) => toTransaction(t)),
    }
  })

  ipcMain.handle(
    'customers:update',
    async (_event, id: string, data: UpdateCustomerInput): Promise<Customer> => {
      const db = getPrisma()
      const settings = await getSettings()

      const updateData: { fullName?: string; phone?: string } = {}
      if (data.fullName !== undefined) updateData.fullName = data.fullName
      if (data.phone !== undefined) updateData.phone = normalizePhone(data.phone)

      const customer = await db.customer.update({
        where: { id },
        data: updateData,
      })

      return toCustomer(customer, isVip(customer, settings))
    },
  )

  ipcMain.handle('customers:getVip', async (): Promise<VipCustomer[]> => {
    const db = getPrisma()
    const settings = await getSettings()

    const customers = await db.customer.findMany({
      orderBy: [{ totalSpent: 'desc' }, { totalOrders: 'desc' }],
    })

    const vipList = customers
      .filter((c) => isVip(c, settings))
      .map((c, index) => ({
        ...toCustomer(c, true),
        rank: index + 1,
        isVip: true,
      }))

    return vipList
  })

  ipcMain.handle('customers:exportCsv', async (): Promise<string> => {
    const db = getPrisma()
    const settings = await getSettings()
    const customers = await db.customer.findMany({ orderBy: { totalSpent: 'desc' } })

    const header = 'نام,موبایل,سفارش‌ها,مجموع خرید,کش‌بک,آخرین خرید,VIP'
    const rows = customers.map((c) =>
      [
        c.fullName || '-',
        c.phone,
        c.totalOrders,
        c.totalSpent,
        c.cashbackBalance,
        c.lastPurchaseAt ? serializeDate(c.lastPurchaseAt) : '-',
        isVip(c, settings) ? 'بله' : 'خیر',
      ].join(','),
    )
    return [header, ...rows].join('\n')
  })

  ipcMain.handle(
    'transactions:create',
    async (_event, input: CreateTransactionInput): Promise<CreateTransactionResult> => {
      const db = getPrisma()
      const normalizedPhone = normalizePhone(input.phone)

      if (!normalizedPhone || normalizedPhone.length < 10) {
        throw new Error('شماره موبایل نامعتبر است')
      }

      const rule = await db.cashbackRule.findFirst({ where: { isActive: true } })
      if (!rule) throw new Error('قانون کش‌بک فعال یافت نشد')

      const result = await db.$transaction(async (tx) => {
        let customer = await tx.customer.findUnique({ where: { phone: normalizedPhone } })

        if (!customer) {
          customer = await tx.customer.create({
            data: {
              phone: normalizedPhone,
              fullName: input.fullName?.trim() || '',
            },
          })
        } else if (input.fullName?.trim() && !customer.fullName) {
          customer = await tx.customer.update({
            where: { id: customer.id },
            data: { fullName: input.fullName.trim() },
          })
        }

        const locked = await tx.customer.findUniqueOrThrow({ where: { id: customer.id } })

        const settlement = settleOrder({
          orderTotal: input.amount,
          discountAmount: input.discountAmount,
          cashbackUsedRequested: input.cashbackUsed ?? 0,
          cashbackBalance: locked.cashbackBalance,
          rule,
        })

        const transaction = await tx.transaction.create({
          data: {
            customerId: locked.id,
            amount: settlement.orderTotal,
            cashbackEarned: settlement.cashbackEarned,
            cashbackUsed: settlement.cashbackUsed,
            finalAmount: settlement.payableAmount,
          },
        })

        const updatedCustomer = await tx.customer.update({
          where: { id: locked.id },
          data: {
            cashbackBalance: settlement.remainingCashbackBalance,
            totalSpent: { increment: settlement.orderTotal },
            totalOrders: { increment: 1 },
            lastPurchaseAt: new Date(),
          },
        })

        return { transaction, updatedCustomer, settlement }
      })

      const settings = await getSettings()

      return {
        customer: toCustomer(result.updatedCustomer, isVip(result.updatedCustomer, settings)),
        transaction: toTransaction(result.transaction),
        orderTotal: result.settlement.orderTotal,
        discountAmount: result.settlement.discountAmount,
        cashbackUsed: result.settlement.cashbackUsed,
        payableAmount: result.settlement.payableAmount,
        cashbackEarned: result.settlement.cashbackEarned,
        remainingCashbackBalance: result.settlement.remainingCashbackBalance,
      }
    },
  )

  ipcMain.handle(
    'transactions:list',
    async (_event, params: TransactionListParams = {}): Promise<PaginatedResult<Transaction>> => {
      const db = getPrisma()
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

      const where: Record<string, unknown> = {}

      if (customerId) where.customerId = customerId

      if (dateFrom || dateTo) {
        where.createdAt = {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        }
      }

      if (search) {
        const searchOr = buildCustomerSearchOr(search)
        if (searchOr.length > 0) {
          where.customer = { OR: searchOr }
        }
      }

      const [total, transactions] = await Promise.all([
        db.transaction.count({ where }),
        db.transaction.findMany({
          where,
          include: { customer: { select: { id: true, fullName: true, phone: true } } },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ])

      return {
        data: transactions.map((t) => toTransaction(t)),
        total,
        page,
        pageSize,
      }
    },
  )

  ipcMain.handle('transactions:exportCsv', async (): Promise<string> => {
    const db = getPrisma()
    const transactions = await db.transaction.findMany({
      include: { customer: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const header = 'شناسه,مشتری,موبایل,مبلغ,کش‌بک دریافتی,کش‌بک مصرفی,مبلغ نهایی,تاریخ'
    const rows = transactions.map((t) =>
      [
        t.id,
        t.customer.fullName || '-',
        t.customer.phone,
        t.amount,
        t.cashbackEarned,
        t.cashbackUsed,
        t.finalAmount,
        serializeDate(t.createdAt),
      ].join(','),
    )

    return [header, ...rows].join('\n')
  })

  ipcMain.handle('cashback:getRule', async () => {
    const db = getPrisma()
    const rule = await db.cashbackRule.findFirst({ where: { isActive: true } })
    if (!rule) throw new Error('قانون کش‌بک یافت نشد')
    return rule
  })

  ipcMain.handle('cashback:updateRule', async (_event, data) => {
    const db = getPrisma()
    const existing = await db.cashbackRule.findFirst({ where: { isActive: true } })
    if (!existing) throw new Error('قانون کش‌بک یافت نشد')
    return db.cashbackRule.update({ where: { id: existing.id }, data })
  })

  ipcMain.handle('settings:get', async (): Promise<Settings> => {
    return getSettings()
  })

  ipcMain.handle('settings:update', async (_event, data): Promise<Settings> => {
    const db = getPrisma()
    return db.settings.update({ where: { id: 'default' }, data })
  })

  ipcMain.handle('settings:verifyPin', async (_event, pin: string): Promise<boolean> => {
    const settings = await getSettings()
    return normalizePin(settings.authPin) === normalizePin(pin)
  })

  ipcMain.handle('database:export', async (): Promise<string> => {
    const db = getPrisma()
    const [customers, transactions, cashbackRules, settings] = await Promise.all([
      db.customer.findMany(),
      db.transaction.findMany(),
      db.cashbackRule.findMany(),
      db.settings.findMany(),
    ])

    return JSON.stringify({ customers, transactions, cashbackRules, settings }, null, 2)
  })

  ipcMain.handle('database:import', async (_event, jsonData: string): Promise<void> => {
    const db = getPrisma()
    const data = JSON.parse(jsonData) as {
      customers: Array<Record<string, unknown>>
      transactions: Array<Record<string, unknown>>
      cashbackRules: Array<Record<string, unknown>>
      settings: Array<Record<string, unknown>>
    }

    await db.$transaction(async (tx) => {
      await tx.transaction.deleteMany()
      await tx.customer.deleteMany()
      await tx.cashbackRule.deleteMany()
      await tx.settings.deleteMany()

      if (data.settings?.length) {
        await tx.settings.createMany({ data: data.settings as never[] })
      } else {
        await tx.settings.create({ data: { id: 'default' } })
      }

      if (data.cashbackRules?.length) {
        await tx.cashbackRule.createMany({ data: data.cashbackRules as never[] })
      }

      if (data.customers?.length) {
        await tx.customer.createMany({ data: data.customers as never[] })
      }

      if (data.transactions?.length) {
        await tx.transaction.createMany({ data: data.transactions as never[] })
      }
    })
  })

  ipcMain.handle('database:backup', async (): Promise<string> => {
    const dbPath = getDbPath()
    const backupDir = path.join(path.dirname(dbPath), 'backups')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`)
    fs.copyFileSync(dbPath, backupPath)
    return backupPath
  })
}
