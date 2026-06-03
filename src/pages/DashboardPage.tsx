import { useEffect, useState } from 'react'
import { Grid, Column, Loading, Tile } from '@carbon/react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { StatTile } from '../components/StatTile'
import type { ChartDataPoint, Customer, DashboardStats, Transaction } from '../types/api'
import { formatCurrency, formatChartDate, formatShortDate, formatPhone, formatRelativeDate } from '../lib/format'
import { Numeric } from '../components/Numeric'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [topCustomers, setTopCustomers] = useState<Customer[]>([])
  const [recentTx, setRecentTx] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.dashboard.getStats(),
      window.api.dashboard.getChartData(30),
      window.api.dashboard.getTopCustomers(5),
      window.api.dashboard.getRecentTransactions(8),
    ])
      .then(([s, chart, top, recent]) => {
        setStats(s)
        setChartData(chart)
        setTopCustomers(top)
        setRecentTx(recent)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading || !stats) return <Loading withOverlay={false} description="در حال بارگذاری..." />

  return (
    <div className="page">
      <h1 className="page-title">داشبورد</h1>

      <Grid narrow className="dashboard-kpi-row">
        <Column lg={4} md={2} sm={4}>
          <StatTile label="مشتریان" value={stats.totalCustomers} />
        </Column>
        <Column lg={4} md={2} sm={4}>
          <StatTile label="VIP" value={stats.vipCustomers} />
        </Column>
        <Column lg={4} md={2} sm={4}>
          <StatTile label="درآمد" value={stats.totalRevenue} isCurrency />
        </Column>
        <Column lg={4} md={2} sm={4}>
          <StatTile label="تراکنش‌ها" value={stats.totalTransactions} />
        </Column>
      </Grid>

      {chartData.length > 0 && (
        <Tile className="chart-container dashboard-chart-full">
          <h2>روند درآمد</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--cds-border-subtle)" />
              <XAxis dataKey="date" stroke="var(--cds-text-secondary)" tick={{ fontSize: 11 }} tickFormatter={formatChartDate} />
              <YAxis stroke="var(--cds-text-secondary)" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  background: 'var(--cds-layer-01)',
                  border: '1px solid var(--cds-border-subtle)',
                }}
              />
              <Line type="monotone" dataKey="revenue" name="درآمد" stroke="var(--cds-link-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Tile>
      )}

      <div className="dashboard-bottom-grid">
        <Tile className="dashboard-list-tile">
          <h2>برترین مشتریان</h2>
          <ul className="dashboard-list">
            {topCustomers.map((c, i) => (
              <li key={c.id}>
                <span className="rank">{i + 1}</span>
                <div>
                  <strong>{c.fullName || formatPhone(c.phone)}</strong>
                  <span><Numeric>{formatCurrency(c.totalSpent)}</Numeric></span>
                </div>
              </li>
            ))}
          </ul>
        </Tile>

        <Tile className="dashboard-list-tile">
          <h2>تراکنش‌های اخیر</h2>
          <ul className="dashboard-list">
            {recentTx.map((tx) => (
              <li key={tx.id}>
                <div>
                  <strong>{tx.customer?.fullName || formatPhone(tx.customer?.phone || '')}</strong>
                  <span>{formatRelativeDate(tx.createdAt)}</span>
                </div>
                <strong><Numeric>{formatCurrency(tx.amount)}</Numeric></strong>
              </li>
            ))}
          </ul>
        </Tile>
      </div>
    </div>
  )
}
