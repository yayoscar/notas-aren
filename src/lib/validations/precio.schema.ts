import { z } from "zod"

export const preciosSchema = z.object({
  precio_compra: z.number().min(0, "Debe ser >= 0"),
  precio_venta_contado: z.number().min(0, "Debe ser >= 0"),
  precio_venta_credito: z.number().min(0, "Debe ser >= 0"),
})

export type PreciosFormValues = z.infer<typeof preciosSchema>
