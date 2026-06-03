import { app, ipcMain, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
let prisma = null;
function getDbPath() {
  const userDataPath = app.getPath("userData");
  const dbDir = path.join(userDataPath, "data");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return path.join(dbDir, "customer-club.db");
}
function getPrisma() {
  if (!prisma) {
    const dbPath = getDbPath();
    prisma = new PrismaClient({
      datasources: {
        db: { url: `file:${dbPath}` }
      }
    });
  }
  return prisma;
}
async function initDatabase() {
  const db = getPrisma();
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
  `);
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
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS CashbackRule (
      id TEXT PRIMARY KEY,
      percentage REAL NOT NULL DEFAULT 5,
      minimumAmount REAL NOT NULL DEFAULT 0,
      maximumAmount REAL NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY,
      businessName TEXT NOT NULL DEFAULT 'باشگاه مشتریان',
      branchName TEXT NOT NULL DEFAULT 'شعبه اصلی',
      vipOrderThreshold INTEGER NOT NULL DEFAULT 10,
      vipSpendingThreshold REAL NOT NULL DEFAULT 5000000,
      authPin TEXT NOT NULL DEFAULT '1234'
    )
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_transaction_customerId ON Transaction(customerId)
  `);
  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_transaction_createdAt ON Transaction(createdAt)
  `);
  try {
    await db.$executeRawUnsafe(`ALTER TABLE Customer ADD COLUMN lastPurchaseAt DATETIME`);
  } catch {
  }
  const customersNeedingBackfill = await db.customer.findMany({
    where: { lastPurchaseAt: null, totalOrders: { gt: 0 } },
    select: { id: true }
  });
  for (const c of customersNeedingBackfill) {
    const lastTx = await db.transaction.findFirst({
      where: { customerId: c.id },
      orderBy: { createdAt: "desc" }
    });
    if (lastTx) {
      await db.customer.update({
        where: { id: c.id },
        data: { lastPurchaseAt: lastTx.createdAt }
      });
    }
  }
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.create({ data: { id: "default" } });
  }
  const ruleCount = await db.cashbackRule.count();
  if (ruleCount === 0) {
    await db.cashbackRule.create({
      data: {
        percentage: 5,
        minimumAmount: 0,
        maximumAmount: 5e5,
        isActive: true
      }
    });
  }
}
async function disconnectDatabase() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function normalizeDigits(value) {
  return value.trim().split("").map((char) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(char);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(char);
    if (arabicIndex >= 0) return String(arabicIndex);
    return char;
  }).join("");
}
function parseAsciiDigits(value) {
  return normalizeDigits(value).replace(/\D/g, "");
}
function normalizePin(pin) {
  return parseAsciiDigits(pin);
}
function normalizePhone(phone) {
  let digits = parseAsciiDigits(phone);
  if (digits.startsWith("98")) {
    digits = "0" + digits.slice(2);
  }
  if (digits.length > 0 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits.slice(0, 11);
}
function serializeDate(date) {
  return date.toISOString();
}
async function getSettings() {
  const db = getPrisma();
  let settings = await db.settings.findUnique({ where: { id: "default" } });
  if (!settings) {
    settings = await db.settings.create({ data: { id: "default" } });
  }
  if (!settings.authPin) {
    settings = await db.settings.update({
      where: { id: "default" },
      data: { authPin: "1234" }
    });
  }
  return settings;
}
function isVip(customer, settings) {
  return customer.totalOrders >= settings.vipOrderThreshold || customer.totalSpent >= settings.vipSpendingThreshold;
}
function toCustomer(customer, vip) {
  return {
    ...customer,
    createdAt: serializeDate(customer.createdAt),
    updatedAt: serializeDate(customer.updatedAt),
    lastPurchaseAt: customer.lastPurchaseAt ? serializeDate(customer.lastPurchaseAt) : null,
    ...vip !== void 0 ? { isVip: vip } : {}
  };
}
function toTransaction(tx) {
  return {
    id: tx.id,
    customerId: tx.customerId,
    amount: tx.amount,
    cashbackEarned: tx.cashbackEarned,
    cashbackUsed: tx.cashbackUsed,
    finalAmount: tx.finalAmount,
    createdAt: serializeDate(tx.createdAt),
    ...tx.customer ? { customer: { id: tx.customer.id, fullName: tx.customer.fullName, phone: tx.customer.phone } } : {}
  };
}
function registerIpcHandlers() {
  ipcMain.handle("dashboard:getStats", async () => {
    const db = getPrisma();
    const settings = await getSettings();
    const [totalCustomers, totalTransactions, aggregates, returningCustomers] = await Promise.all([
      db.customer.count(),
      db.transaction.count(),
      db.transaction.aggregate({
        _sum: { amount: true, cashbackEarned: true, cashbackUsed: true },
        _avg: { amount: true }
      }),
      db.customer.count({ where: { totalOrders: { gt: 1 } } })
    ]);
    const allCustomers = await db.customer.findMany({
      select: { totalOrders: true, totalSpent: true }
    });
    const vipCustomers = allCustomers.filter((c) => isVip(c, settings)).length;
    const totalRevenue = aggregates._sum.amount ?? 0;
    const totalWithOrders = totalCustomers || 1;
    return {
      totalCustomers,
      vipCustomers,
      totalTransactions,
      totalRevenue,
      cashbackGenerated: aggregates._sum.cashbackEarned ?? 0,
      cashbackConsumed: aggregates._sum.cashbackUsed ?? 0,
      averageOrderValue: aggregates._avg.amount ?? 0,
      returningCustomerRate: returningCustomers / totalWithOrders * 100
    };
  });
  ipcMain.handle("dashboard:getChartData", async (_event, days = 30) => {
    const db = getPrisma();
    const since = /* @__PURE__ */ new Date();
    since.setDate(since.getDate() - days);
    const transactions = await db.transaction.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "asc" }
    });
    const grouped = /* @__PURE__ */ new Map();
    for (const tx of transactions) {
      const date = tx.createdAt.toISOString().split("T")[0];
      const existing = grouped.get(date) ?? { revenue: 0, transactions: 0, cashback: 0 };
      existing.revenue += tx.amount;
      existing.transactions += 1;
      existing.cashback += tx.cashbackEarned;
      grouped.set(date, existing);
    }
    return Array.from(grouped.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      transactions: data.transactions,
      cashback: data.cashback
    }));
  });
  ipcMain.handle("dashboard:getTopCustomers", async (_event, limit = 5) => {
    const db = getPrisma();
    const settings = await getSettings();
    const customers = await db.customer.findMany({
      orderBy: { totalSpent: "desc" },
      take: limit
    });
    return customers.map((c) => toCustomer(c, isVip(c, settings)));
  });
  ipcMain.handle("dashboard:getRecentTransactions", async (_event, limit = 8) => {
    const db = getPrisma();
    const transactions = await db.transaction.findMany({
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: limit
    });
    return transactions.map((t) => toTransaction(t));
  });
  ipcMain.handle("customers:lookup", async (_event, phone) => {
    const db = getPrisma();
    const settings = await getSettings();
    const normalized = normalizePhone(phone);
    const customer = await db.customer.findUnique({ where: { phone: normalized } });
    if (!customer) return null;
    return toCustomer(customer, isVip(customer, settings));
  });
  ipcMain.handle(
    "customers:list",
    async (_event, params = {}) => {
      const db = getPrisma();
      const settings = await getSettings();
      const {
        search = "",
        vipOnly = false,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = 1,
        pageSize = 20
      } = params;
      const andConditions = [];
      if (search) {
        andConditions.push({
          OR: [
            { phone: { contains: parseAsciiDigits(search) } },
            { fullName: { contains: search } }
          ]
        });
      }
      if (vipOnly) {
        andConditions.push({
          OR: [
            { totalOrders: { gte: settings.vipOrderThreshold } },
            { totalSpent: { gte: settings.vipSpendingThreshold } }
          ]
        });
      }
      const where = andConditions.length > 0 ? { AND: andConditions } : {};
      const [total, customers] = await Promise.all([
        db.customer.count({ where }),
        db.customer.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize
        })
      ]);
      return {
        data: customers.map((c) => toCustomer(c, isVip(c, settings))),
        total,
        page,
        pageSize
      };
    }
  );
  ipcMain.handle("customers:get", async (_event, id) => {
    const db = getPrisma();
    const settings = await getSettings();
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        transactions: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!customer) throw new Error("مشتری یافت نشد");
    const cashbackEarned = customer.transactions.reduce((sum, t) => sum + t.cashbackEarned, 0);
    const cashbackUsed = customer.transactions.reduce((sum, t) => sum + t.cashbackUsed, 0);
    return {
      ...toCustomer(customer, isVip(customer, settings)),
      averageOrderValue: customer.totalOrders > 0 ? customer.totalSpent / customer.totalOrders : 0,
      cashbackEarned,
      cashbackUsed,
      transactions: customer.transactions.map((t) => toTransaction(t))
    };
  });
  ipcMain.handle(
    "customers:update",
    async (_event, id, data) => {
      const db = getPrisma();
      const settings = await getSettings();
      const updateData = {};
      if (data.fullName !== void 0) updateData.fullName = data.fullName;
      if (data.phone !== void 0) updateData.phone = normalizePhone(data.phone);
      const customer = await db.customer.update({
        where: { id },
        data: updateData
      });
      return toCustomer(customer, isVip(customer, settings));
    }
  );
  ipcMain.handle("customers:getVip", async () => {
    const db = getPrisma();
    const settings = await getSettings();
    const customers = await db.customer.findMany({
      orderBy: [{ totalSpent: "desc" }, { totalOrders: "desc" }]
    });
    const vipList = customers.filter((c) => isVip(c, settings)).map((c, index) => ({
      ...toCustomer(c, true),
      rank: index + 1,
      isVip: true
    }));
    return vipList;
  });
  ipcMain.handle("customers:exportCsv", async () => {
    const db = getPrisma();
    const settings = await getSettings();
    const customers = await db.customer.findMany({ orderBy: { totalSpent: "desc" } });
    const header = "نام,موبایل,سفارش‌ها,مجموع خرید,کش‌بک,آخرین خرید,VIP";
    const rows = customers.map(
      (c) => [
        c.fullName || "-",
        c.phone,
        c.totalOrders,
        c.totalSpent,
        c.cashbackBalance,
        c.lastPurchaseAt ? serializeDate(c.lastPurchaseAt) : "-",
        isVip(c, settings) ? "بله" : "خیر"
      ].join(",")
    );
    return [header, ...rows].join("\n");
  });
  ipcMain.handle(
    "transactions:create",
    async (_event, input) => {
      var _a, _b;
      const db = getPrisma();
      const normalizedPhone = normalizePhone(input.phone);
      if (!normalizedPhone || normalizedPhone.length < 10) {
        throw new Error("شماره موبایل نامعتبر است");
      }
      if (input.amount <= 0) {
        throw new Error("مبلغ فاکتور باید بیشتر از صفر باشد");
      }
      const rule = await db.cashbackRule.findFirst({ where: { isActive: true } });
      if (!rule) throw new Error("قانون کش‌بک فعال یافت نشد");
      let customer = await db.customer.findUnique({ where: { phone: normalizedPhone } });
      if (!customer) {
        customer = await db.customer.create({
          data: {
            phone: normalizedPhone,
            fullName: ((_a = input.fullName) == null ? void 0 : _a.trim()) || ""
          }
        });
      } else if (((_b = input.fullName) == null ? void 0 : _b.trim()) && !customer.fullName) {
        customer = await db.customer.update({
          where: { id: customer.id },
          data: { fullName: input.fullName.trim() }
        });
      }
      const cashbackUsed = Math.min(
        input.cashbackUsed ?? 0,
        customer.cashbackBalance,
        input.amount
      );
      if (cashbackUsed < 0) {
        throw new Error("مبلغ کش‌بک مصرفی نامعتبر است");
      }
      let cashbackEarned = 0;
      if (rule.isActive && input.amount >= rule.minimumAmount) {
        cashbackEarned = input.amount * rule.percentage / 100;
        if (rule.maximumAmount > 0) {
          cashbackEarned = Math.min(cashbackEarned, rule.maximumAmount);
        }
      }
      const finalAmount = input.amount - cashbackUsed;
      const newBalance = customer.cashbackBalance - cashbackUsed + cashbackEarned;
      const result = await db.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            customerId: customer.id,
            amount: input.amount,
            cashbackEarned,
            cashbackUsed,
            finalAmount
          }
        });
        const updatedCustomer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            cashbackBalance: newBalance,
            totalSpent: { increment: input.amount },
            totalOrders: { increment: 1 },
            lastPurchaseAt: /* @__PURE__ */ new Date()
          }
        });
        return { transaction, updatedCustomer };
      });
      const settings = await getSettings();
      return {
        customer: toCustomer(result.updatedCustomer, isVip(result.updatedCustomer, settings)),
        transaction: toTransaction(result.transaction)
      };
    }
  );
  ipcMain.handle(
    "transactions:list",
    async (_event, params = {}) => {
      const db = getPrisma();
      const {
        search = "",
        customerId,
        dateFrom,
        dateTo,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = 1,
        pageSize = 20
      } = params;
      const where = {};
      if (customerId) where.customerId = customerId;
      if (dateFrom || dateTo) {
        where.createdAt = {
          ...dateFrom ? { gte: new Date(dateFrom) } : {},
          ...dateTo ? { lte: new Date(dateTo) } : {}
        };
      }
      if (search) {
        where.customer = {
          OR: [
            { phone: { contains: parseAsciiDigits(search) } },
            { fullName: { contains: search } }
          ]
        };
      }
      const [total, transactions] = await Promise.all([
        db.transaction.count({ where }),
        db.transaction.findMany({
          where,
          include: { customer: { select: { id: true, fullName: true, phone: true } } },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize
        })
      ]);
      return {
        data: transactions.map((t) => toTransaction(t)),
        total,
        page,
        pageSize
      };
    }
  );
  ipcMain.handle("transactions:exportCsv", async () => {
    const db = getPrisma();
    const transactions = await db.transaction.findMany({
      include: { customer: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" }
    });
    const header = "شناسه,مشتری,موبایل,مبلغ,کش‌بک دریافتی,کش‌بک مصرفی,مبلغ نهایی,تاریخ";
    const rows = transactions.map(
      (t) => [
        t.id,
        t.customer.fullName || "-",
        t.customer.phone,
        t.amount,
        t.cashbackEarned,
        t.cashbackUsed,
        t.finalAmount,
        serializeDate(t.createdAt)
      ].join(",")
    );
    return [header, ...rows].join("\n");
  });
  ipcMain.handle("cashback:getRule", async () => {
    const db = getPrisma();
    const rule = await db.cashbackRule.findFirst({ where: { isActive: true } });
    if (!rule) throw new Error("قانون کش‌بک یافت نشد");
    return rule;
  });
  ipcMain.handle("cashback:updateRule", async (_event, data) => {
    const db = getPrisma();
    const existing = await db.cashbackRule.findFirst({ where: { isActive: true } });
    if (!existing) throw new Error("قانون کش‌بک یافت نشد");
    return db.cashbackRule.update({ where: { id: existing.id }, data });
  });
  ipcMain.handle("settings:get", async () => {
    return getSettings();
  });
  ipcMain.handle("settings:update", async (_event, data) => {
    const db = getPrisma();
    return db.settings.update({ where: { id: "default" }, data });
  });
  ipcMain.handle("settings:verifyPin", async (_event, pin) => {
    const settings = await getSettings();
    return normalizePin(settings.authPin) === normalizePin(pin);
  });
  ipcMain.handle("database:export", async () => {
    const db = getPrisma();
    const [customers, transactions, cashbackRules, settings] = await Promise.all([
      db.customer.findMany(),
      db.transaction.findMany(),
      db.cashbackRule.findMany(),
      db.settings.findMany()
    ]);
    return JSON.stringify({ customers, transactions, cashbackRules, settings }, null, 2);
  });
  ipcMain.handle("database:import", async (_event, jsonData) => {
    const db = getPrisma();
    const data = JSON.parse(jsonData);
    await db.$transaction(async (tx) => {
      var _a, _b, _c, _d;
      await tx.transaction.deleteMany();
      await tx.customer.deleteMany();
      await tx.cashbackRule.deleteMany();
      await tx.settings.deleteMany();
      if ((_a = data.settings) == null ? void 0 : _a.length) {
        await tx.settings.createMany({ data: data.settings });
      } else {
        await tx.settings.create({ data: { id: "default" } });
      }
      if ((_b = data.cashbackRules) == null ? void 0 : _b.length) {
        await tx.cashbackRule.createMany({ data: data.cashbackRules });
      }
      if ((_c = data.customers) == null ? void 0 : _c.length) {
        await tx.customer.createMany({ data: data.customers });
      }
      if ((_d = data.transactions) == null ? void 0 : _d.length) {
        await tx.transaction.createMany({ data: data.transactions });
      }
    });
  });
  ipcMain.handle("database:backup", async () => {
    const dbPath = getDbPath();
    const backupDir = path.join(path.dirname(dbPath), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
  });
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "باشگاه مشتریان",
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(async () => {
  try {
    await initDatabase();
    registerIpcHandlers();
  } catch (err) {
    console.error("[database] init failed:", err);
  }
  createWindow();
});
app.on("before-quit", async () => {
  await disconnectDatabase();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
