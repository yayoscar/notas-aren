import { z } from "zod"

export const gastoSchema = z
  .object({
    concepto: z.string().min(1, "El concepto es requerido"),
    monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
    categoria_id: z.string().uuid("Selecciona una categoría"),
    fecha: z.string().min(1, "La fecha es requerida"),
    tipo_pago: z.enum(["efectivo", "transferencia", "retiro_sin_tarjeta"], {
      required_error: "Selecciona el tipo de pago",
    }),
    cuenta_bancaria_id: z.string().uuid().nullable().optional(),
  })
  .superRefine((data, ctx) => {
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

export type GastoFormValues = z.infer<typeof gastoSchema>
