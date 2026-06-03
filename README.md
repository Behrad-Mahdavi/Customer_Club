# Customer Club — باشگاه مشتریان

سیستم باشگاه مشتریان و مدیریت کش‌بک برای صندوق فروش (POS) — کاملاً آفلاین.

## Tech Stack

- Electron + React + TypeScript
- Carbon Design System
- SQLite + Prisma
- Zustand, React Hook Form, Zod, TanStack Table, Recharts

## Setup

```bash
cd customer-club
npm install
npm run db:push
npm run dev
```

## Default Login

- PIN: `1234` (قابل تغییر در تنظیمات)

## Modules

| ماژول | مسیر |
|--------|------|
| داشبورد | `/` |
| صندوق فروش | `/pos` |
| مشتریان | `/customers` |
| VIP | `/vip` |
| تراکنش‌ها | `/transactions` |
| کش‌بک | `/cashback` |
| تنظیمات | `/settings` |

## Database

دیتابیس SQLite در مسیر userData اپ Electron ذخیره می‌شود.
