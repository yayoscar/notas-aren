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

/**
 * Convert a date-only string (YYYY-MM-DD) to a full ISO timestamp
 * safe from timezone shift. Uses noon local time so the calendar day
 * is preserved regardless of UTC offset.
 * If the string already contains "T" (i.e. it's already an ISO timestamp), returns as-is.
 */
export function localDateToISO(dateStr: string): string {
  if (dateStr.includes("T")) return dateStr
  return new Date(dateStr + "T12:00:00").toISOString()
}

/** Format a date string (YYYY-MM-DD or ISO timestamp) for display in es-MX locale. */
export function formatDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("es-MX")
}

/**
 * Normalize a Mexican phone number for use in `wa.me` URLs.
 * Strips spaces, dashes, parentheses, plus signs, and a leading country code "52".
 * Returns empty string if input is null/empty.
 */
export function limpiarTelefono(tel: string | null | undefined): string {
  if (!tel) return ""
  return tel.replace(/[\s\-()+]/g, "").replace(/^52/, "")
}
