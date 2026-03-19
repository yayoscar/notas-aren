import { z } from "zod"

const abonoBaseSchema = z.object({
  venta_id: z.string().uuid("Selecciona un crédito"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  tipo_pago: z.enum(["efectivo", "transferencia", "retiro_sin_tarjeta"], {
    message: "Selecciona el tipo de pago",
  }),
  cuenta_bancaria_id: z.string().uuid().nullable().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
})

export const abonoSchema = abonoBaseSchema.superRefine((data, ctx) => {
  if (
    data.tipo_pago === "transferencia" &&
    !data.cuenta_bancaria_id
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Selecciona la cuenta bancaria",
      path: ["cuenta_bancaria_id"],
    })
  }
})

export type AbonoFormValues = z.infer<typeof abonoBaseSchema>
