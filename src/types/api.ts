export interface Customer {
  id: string
  fullName: string
  phone: string
  cashbackBalance: number
  totalSpent: number
  totalOrders: number
  createdAt: string
  updatedAt: string
  lastPurchaseAt?: string | null
  isVip?: boolean
}

export interface Transaction {
  id: string
  customerId: string
  amount: number
  cashbackEarned: number
  cashbackUsed: number
  finalAmount: number
  createdAt: string
  customer?: Pick<Customer, 'id' | 'fullName' | 'phone'>
}

export interface CashbackRule {
  id: string
  percentage: number
  minimumAmount: number
  maximumAmount: number
  isActive: boolean
}

export interface Settings {
  id: string
  businessName: string
  branchName: string
  vipOrderThreshold: number
  vipSpendingThreshold: number
  authPin: string
}

export interface DashboardStats {
  totalCustomers: number
  vipCustomers: number
  totalTransactions: number
  totalRevenue: number
  cashbackGenerated: number
  cashbackConsumed: number
  averageOrderValue: number
  returningCustomerRate: number
}

export interface CustomerListParams {
  search?: string
  vipOnly?: boolean
  sortBy?: 'fullName' | 'phone' | 'totalOrders' | 'totalSpent' | 'cashbackBalance' | 'createdAt' | 'updatedAt' | 'lastPurchaseAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface TransactionListParams {
  search?: string
  customerId?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: 'createdAt' | 'amount' | 'finalAmount' | 'cashbackEarned' | 'cashbackUsed'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface CreateTransactionInput {
  phone: string
  fullName?: string
  amount: number
  cashbackUsed?: number
}

export interface UpdateCustomerInput {
  fullName?: string
  phone?: string
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface CustomerProfile extends Customer {
  averageOrderValue: number
  cashbackEarned: number
  cashbackUsed: number
  transactions: Transaction[]
}

export interface VipCustomer extends Customer {
  rank: number
  isVip: boolean
}

export interface ChartDataPoint {
  date: string
  revenue: number
  transactions: number
  cashback: number
}

export interface ElectronAPI {
  dashboard: {
    getStats: () => Promise<DashboardStats>
    getChartData: (days?: number) => Promise<ChartDataPoint[]>
    getTopCustomers: (limit?: number) => Promise<Customer[]>
    getRecentTransactions: (limit?: number) => Promise<Transaction[]>
  }
  customers: {
    lookup: (phone: string) => Promise<Customer | null>
    list: (params?: CustomerListParams) => Promise<PaginatedResult<Customer>>
    get: (id: string) => Promise<CustomerProfile>
    update: (id: string, data: UpdateCustomerInput) => Promise<Customer>
    getVip: () => Promise<VipCustomer[]>
    exportCsv: () => Promise<string>
  }
  transactions: {
    create: (data: CreateTransactionInput) => Promise<{ customer: Customer; transaction: Transaction }>
    list: (params?: TransactionListParams) => Promise<PaginatedResult<Transaction>>
    exportCsv: () => Promise<string>
  }
  cashback: {
    getRule: () => Promise<CashbackRule>
    updateRule: (data: Partial<Omit<CashbackRule, 'id'>>) => Promise<CashbackRule>
  }
  settings: {
    get: () => Promise<Settings>
    update: (data: Partial<Omit<Settings, 'id'>>) => Promise<Settings>
    verifyPin: (pin: string) => Promise<boolean>
  }
  database: {
    export: () => Promise<string>
    import: (jsonData: string) => Promise<void>
    backup: () => Promise<string>
  }
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
