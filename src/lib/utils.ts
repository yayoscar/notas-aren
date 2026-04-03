import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format as price: $ 1,250.00 */
export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Format as quantity: 1,250 (no decimals) */
export function formatQty(value: number): string {
  return Math.round(value).toLocaleString("en-US")
}

/** Return today's date as YYYY-MM-DD in the browser's local timezone. */
export function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Safely parse a date-only string (YYYY-MM-DD) from the DB
 * without timezone shift. Treats the string as local noon
 * so it always resolves to the correct calendar day.
 */
export function parseLocalDate(dateStr: string): Date {
  if (dateStr.includes("T")) return new Date(dateStr)
  return new Date(dateStr + "T12:00:00")
}

/** Format a date string (YYYY-MM-DD or ISO timestamp) for display in es-MX locale. */
export function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("es-MX")
}
