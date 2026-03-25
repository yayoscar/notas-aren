import { z } from "zod"

export const aplicarSaldoSchema = z.object({
  saldo_favor_id: z.string().uuid(),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  destino: z.enum(["credito_sistema", "efectivo"], {
    message: "Selecciona el destino del saldo",
  }),
})

export type AplicarSaldoValues = z.infer<typeof aplicarSaldoSchema>
