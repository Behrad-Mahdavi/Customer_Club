import dayjs from 'dayjs'
import jalaliday from 'jalaliday'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fa'
import { parseAsciiDigits } from './normalize'

export { normalizePhone } from './normalize'

dayjs.extend(jalaliday)
dayjs.extend(relativeTime)
dayjs.locale('fa')

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(Math.round(amount)) + ' تومان'
}

/** Preview under price inputs: `90000` → `90,000 تومان` */
export function formatAmountHint(value: string | number): string {
  const n =
    typeof value === 'string'
      ? Number(parseAsciiDigits(value))
      : Math.round(Number(value) || 0)
  if (n <= 0) return ''
  return `${new Intl.NumberFormat('en-US').format(n)} تومان`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fa-IR').format(num)
}

export function toJalali(date: string | Date) {
  return dayjs(date).calendar('jalali')
}

export function formatDate(date: string | Date): string {
  return toJalali(date).format('YYYY/MM/DD HH:mm')
}

export function formatShortDate(date: string | Date): string {
  return toJalali(date).format('YYYY/MM/DD')
}

export function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return toJalali(date).fromNow()
}

export function formatChartDate(date: string): string {
  return toJalali(date).format('MM/DD')
}

export function formatPhone(phone: string): string {
  const digits = parseAsciiDigits(phone)
  if (digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

export function shortId(id: string): string {
  return id.slice(-8).toUpperCase()
}

export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
