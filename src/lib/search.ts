import { normalizeDigits, normalizePersianText, parseAsciiDigits } from './normalize'

export interface SplitSearchQuery {
  nameQuery: string
  phoneDigits: string
}

/** Split user search into name text vs phone digits (never empty-string phone match). */
export function splitSearchQuery(search: string): SplitSearchQuery {
  const trimmed = search.trim()
  const phoneDigits = parseAsciiDigits(trimmed)
  const nameQuery = normalizePersianText(normalizeDigits(trimmed).replace(/\d/g, ''))
  return { nameQuery, phoneDigits }
}

type NamePhoneWhere = {
  fullName?: { contains: string }
  phone?: { contains: string }
}

/** Prisma `OR` conditions for customer name / phone search. */
export function buildCustomerSearchOr(search: string): NamePhoneWhere[] {
  const { nameQuery, phoneDigits } = splitSearchQuery(search)
  const or: NamePhoneWhere[] = []
  if (nameQuery) or.push({ fullName: { contains: nameQuery } })
  if (phoneDigits) or.push({ phone: { contains: phoneDigits } })
  return or
}

export function matchesCustomerSearch(
  customer: { fullName: string; phone: string },
  search: string,
): boolean {
  const trimmed = search.trim()
  if (!trimmed) return true

  const { nameQuery, phoneDigits } = splitSearchQuery(trimmed)
  if (!nameQuery && !phoneDigits) return false

  const normalizedName = normalizePersianText(customer.fullName || '')
  const nameMatch = nameQuery ? normalizedName.includes(nameQuery) : false
  const phoneMatch = phoneDigits ? customer.phone.includes(phoneDigits) : false

  if (nameQuery && phoneDigits) return nameMatch || phoneMatch
  if (nameQuery) return nameMatch
  return phoneMatch
}
