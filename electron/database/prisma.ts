import { PrismaClient } from '@prisma/client'
import path from 'node:path'
import { app } from 'electron'
import fs from 'node:fs'

let prisma: PrismaClient | null = null

export function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = path.join(userDataPath, 'data')
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  return path.join(dbDir, 'customer-club.db')
}

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const dbPath = getDbPath()
    prisma = new PrismaClient({
      datasources: {
        db: { url: `file:${dbPath}` },
      },
    })
  }
  return prisma
}

export async function initDatabase(): Promise<void> {
  const db = getPrisma()

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Customer (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL UNIQUE,
      cashbackBalance REAL NOT NULL DEFAULT 0,
      totalSpent REAL NOT NULL DEFAULT 0,
      totalOrders INTEGER NOT NULL DEFAULT 0,
      lastPurchaseAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Transaction (
      id TEXT PRIMARY KEY,
      customerId TEXT NOT NULL,
      amount REAL NOT NULL,
      cashbackEarned REAL NOT NULL DEFAULT 0,
      cashbackUsed REAL NOT NULL DEFAULT 0,
      finalAmount REAL NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES Customer(id) ON DELETE CASCADE
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CashbackRule (
      id TEXT PRIMARY KEY,
      percentage REAL NOT NULL DEFAULT 5,
      minimumAmount REAL NOT NULL DEFAULT 0,
      maximumAmount REAL NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY,
      businessName TEXT NOT NULL DEFAULT 'باشگاه مشتریان',
      branchName TEXT NOT NULL DEFAULT 'شعبه اصلی',
      vipOrderThreshold INTEGER NOT NULL DEFAULT 10,
      vipSpendingThreshold REAL NOT NULL DEFAULT 5000000,
      authPin TEXT NOT NULL DEFAULT '1234'
    )
  `)

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_transaction_customerId ON Transaction(customerId)
  `)
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_transaction_createdAt ON Transaction(createdAt)
  `)

  try {
    await db.$executeRawUnsafe(`ALTER TABLE Customer ADD COLUMN lastPurchaseAt DATETIME`)
  } catch {
    // column already exists
  }

  // backfill lastPurchaseAt for existing customers
  const customersNeedingBackfill = await db.customer.findMany({
    where: { lastPurchaseAt: null, totalOrders: { gt: 0 } },
    select: { id: true },
  })
  for (const c of customersNeedingBackfill) {
    const lastTx = await db.transaction.findFirst({
      where: { customerId: c.id },
      orderBy: { createdAt: 'desc' },
    })
    if (lastTx) {
      await db.customer.update({
        where: { id: c.id },
        data: { lastPurchaseAt: lastTx.createdAt },
      })
    }
  }

  const settingsCount = await db.settings.count()
  if (settingsCount === 0) {
    await db.settings.create({ data: { id: 'default' } })
  }

  const ruleCount = await db.cashbackRule.count()
  if (ruleCount === 0) {
    await db.cashbackRule.create({
      data: {
        percentage: 5,
        minimumAmount: 0,
        maximumAmount: 500000,
        isActive: true,
      },
    })
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}
