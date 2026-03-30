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

export const importClienteRowSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  telefono: z.string().regex(/^\d{10}$/, "Teléfono debe ser de 10 dígitos"),
  fecha_nacimiento: z
    .string()
    .optional()
    .transform((val) => (val ? val : undefined))
    .refine(
      (val) => {
        if (!val) return true
        return parseDateDDMMYYYY(val) !== null
      },
      { message: "Fecha debe tener formato DD/MM/AAAA" }
    ),
})

export type ImportClienteRow = z.infer<typeof importClienteRowSchema>

export function convertClienteDateToISO(dateStr: string): string | null {
  return parseDateDDMMYYYY(dateStr)
}

export const CLIENTE_TEMPLATE_COLUMNS: ColumnDef[] = [
  { key: "nombre", label: "Nombre", required: true },
  { key: "telefono", label: "Teléfono", required: true },
  { key: "fecha_nacimiento", label: "Fecha de Cumpleaños", required: false },
]

export const CLIENTE_SAMPLE_ROWS = [
  { nombre: "María López", telefono: "5512345678", fecha_nacimiento: "15/03/1990" },
  { nombre: "Juan Pérez", telefono: "5587654321", fecha_nacimiento: "" },
]
