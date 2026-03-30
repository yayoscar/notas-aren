import { z } from "zod"

export const ajustePlanSchema = z.object({
  linea_credito_id: z.string().uuid(),
  meses_credito: z.coerce.number().int().min(1, "Mínimo 1 mes").max(6, "Máximo 6 meses"),
  periodicidad: z.enum(["semanal", "quincenal", "mensual"], {
    message: "Selecciona la periodicidad",
  }),
  fecha_siguiente_pago: z.string().min(1, "La fecha es requerida"),
})

export type AjustePlanFormValues = z.infer<typeof ajustePlanSchema>
