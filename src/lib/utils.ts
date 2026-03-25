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
