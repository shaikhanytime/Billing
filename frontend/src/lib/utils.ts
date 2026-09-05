import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatPaise(paise: number = 0): string {
  return formatCurrency(paise / 100)
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd MMM yyyy, hh:mm a')
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function generateSKU(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()
  const suffix = Math.floor(Math.random() * 9000 + 1000)
  return `${prefix}-${suffix}`
}

/**
 * Calculate EAN-13 check digit
 */
export function calculateEAN13CheckDigit(digits: string): number {
  const d = digits.split('').map(Number)
  const sum = d.reduce((acc, digit, i) => {
    return acc + digit * (i % 2 === 0 ? 1 : 3)
  }, 0)
  return (10 - (sum % 10)) % 10
}

/**
 * Generate a valid EAN-13 barcode value
 * Format: 890 (India) + 9-digit random + check digit
 */
export function generateEAN13(): string {
  const prefix = '890' // India country code
  const random = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  const base = prefix + random
  const checkDigit = calculateEAN13CheckDigit(base)
  return base + checkDigit
}

export function truncate(str: string, length = 30): string {
  return str.length > length ? str.substring(0, length) + '…' : str
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}
