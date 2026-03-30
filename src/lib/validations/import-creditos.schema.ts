import { z } from "zod"
import type { ColumnDef } from "@/lib/import-utils"

function parseDateDDMMYYYY(val: string): string | null {
  if (!val) return null
  const match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (
    date.getFullYear() !== Number(yyyy) ||
    date.getMonth() !== Number(mm) - 1 ||
    date.getDate() !== Number(dd)
  ) {
    return null
  }
  return `${yyyy}-${mm}-${dd}`
}

export const importCreditoRowSchema = z
  .object({
    cliente: z.string().min(1, "Cliente es requerido"),
    telefono_cliente: z.string().regex(/^\d{10}$/, "Teléfono debe ser de 10 dígitos"),
    credito_total: z.coerce.number().positive("Crédito total debe ser positivo"),
    monto_saldado: z.coerce.number().min(0, "Monto saldado no puede ser negativo"),
    periodicidad: z.enum(["semanal", "quincenal", "mensual"], {
      message: "Periodicidad debe ser: semanal, quincenal o mensual",
    }),
    ultima_fecha_pago: z.string().refine(
      (val) => parseDateDDMMYYYY(val) !== null,
      { message: "Fecha debe tener formato DD/MM/AAAA" }
    ),
    monto_ultimo_pago: z.coerce.number().positive("Monto último pago debe ser positivo"),
    numero_meses: z.coerce.number().int().positive("Número de meses debe ser entero positivo"),
  })
  .refine((data) => data.monto_saldado <= data.credito_total, {
    message: "Monto saldado no puede ser mayor al crédito total",
    path: ["monto_saldado"],
  })

export type ImportCreditoRow = z.infer<typeof importCreditoRowSchema>

export function convertCreditoDateToISO(dateStr: string): string {
  return parseDateDDMMYYYY(dateStr)!
}

export const CREDITO_TEMPLATE_COLUMNS: ColumnDef[] = [
  { key: "cliente", label: "Cliente", required: true },
  { key: "telefono_cliente", label: "Teléfono Cliente", required: true },
  { key: "credito_total", label: "Crédito Total", required: true },
  { key: "monto_saldado", label: "Monto Saldado", required: true },
  { key: "periodicidad", label: "Periodicidad", required: true },
  { key: "ultima_fecha_pago", label: "Última Fecha de Pago", required: true },
  { key: "monto_ultimo_pago", label: "Monto Último Pago", required: true },
  { key: "numero_meses", label: "Número de Meses", required: true },
]

export const CREDITO_SAMPLE_ROWS = [
  {
    cliente: "María López",
    telefono_cliente: "5512345678",
    credito_total: 5000,
    monto_saldado: 2000,
    periodicidad: "quincenal",
    ultima_fecha_pago: "15/03/2026",
    monto_ultimo_pago: 500,
    numero_meses: 6,
  },
]
