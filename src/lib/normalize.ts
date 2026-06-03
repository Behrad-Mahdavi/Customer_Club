const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Convert Persian/Arabic digits to ASCII (0-9). */
export function normalizeDigits(value: string): string {
  return value
    .trim()
    .split('')
    .map((char) => {
      const persianIndex = PERSIAN_DIGITS.indexOf(char)
      if (persianIndex >= 0) return String(persianIndex)
      const arabicIndex = ARABIC_DIGITS.indexOf(char)
      if (arabicIndex >= 0) return String(arabicIndex)
      return char
    })
    .join('')
}

/** Digits only, after normalizing Persian/Arabic numerals. */
export function parseAsciiDigits(value: string): string {
  return normalizeDigits(value).replace(/\D/g, '')
}

/** For money/amount text inputs — strips non-digits after digit normalization. */
export function normalizeAmountInput(value: string): string {
  return parseAsciiDigits(value)
}

export function normalizePin(pin: string): string {
  return parseAsciiDigits(pin)
}

/**
 * Iranian mobile/local phone normalization:
 * - Persian/Arabic digits → ASCII
 * - 98… → 0…
 * - Leading 0 added when missing (e.g. 912… → 0912…)
 */
export function normalizePhone(phone: string): string {
  let digits = parseAsciiDigits(phone)

  if (digits.startsWith('98')) {
    digits = '0' + digits.slice(2)
  }

  if (digits.length > 0 && !digits.startsWith('0')) {
    digits = '0' + digits
  }

  return digits.slice(0, 11)
}

/** Unify common Persian/Arabic letter variants for search & display. */
export function normalizePersianText(value: string): string {
  return normalizeDigits(value)
    .replace(/\u064A/g, '\u06CC') // Arabic yeh → Persian yeh
    .replace(/\u0643/g, '\u06A9') // Arabic kaf → Persian kaf
    .replace(/\u0629/g, '\u0647') // tā marbuta → heh
    .replace(/\u200C/g, '') // ZWNJ
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Use while typing in phone fields (same rules as normalizePhone). */
export function sanitizePhoneInput(value: string): string {
  return normalizePhone(value)
}
