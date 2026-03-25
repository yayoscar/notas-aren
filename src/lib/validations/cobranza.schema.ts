import { z } from "zod"

export const fechaCobroSchema = z.object({
  venta_id: z.string().uuid(),
  fecha_cobro_especifica: z.string().min(1, "Selecciona una fecha"),
})

export type FechaCobroFormValues = z.infer<typeof fechaCobroSchema>
