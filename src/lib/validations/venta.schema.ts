import { z } from "zod"

export const ventaDetalleSchema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  precio_unitario: z.coerce.number().min(0.01, "Precio requerido"),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  // Campos auxiliares (no se envían a la BD)
  _nombre: z.string().optional(),
  _stock_actual: z.number().optional(),
  _precio_minimo: z.number().optional(),
})

export const pagoInlineSchema = z.object({
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  tipo_pago: z.enum(["efectivo", "transferencia", "retiro_sin_tarjeta"], {
    required_error: "Selecciona el tipo de pago",
  }),
  cuenta_bancaria_id: z.string().uuid().nullable().optional(),
})

export const ventaSchema = z
  .object({
    cliente_id: z.string().uuid("Selecciona un cliente"),
    tipo_venta: z.enum(["contado", "credito"], {
      required_error: "Selecciona el tipo de venta",
    }),
    fecha: z.string().min(1, "La fecha es requerida"),
    detalles: z
      .array(ventaDetalleSchema)
      .min(1, "Agrega al menos un producto"),
    // Pago contado
    pago: pagoInlineSchema.optional(),
    // Campos de crédito
    periodicidad: z
      .enum(["semanal", "quincenal", "mensual"])
      .nullable()
      .optional(),
    meses_credito: z.coerce
      .number()
      .int()
      .min(1)
      .max(3)
      .nullable()
      .optional(),
    fecha_primer_pago: z.string().nullable().optional(),
    entrega_despues_pago: z.boolean().optional(),
    primer_abono: pagoInlineSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo_venta === "contado") {
      if (!data.pago) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El pago es requerido para ventas de contado",
          path: ["pago"],
        })
      }
    }

    if (data.tipo_venta === "credito") {
      if (!data.periodicidad) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona la periodicidad",
          path: ["periodicidad"],
        })
      }
      if (!data.fecha_primer_pago) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La fecha del primer pago es requerida",
          path: ["fecha_primer_pago"],
        })
      }
      if (!data.meses_credito) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona el plazo del crédito",
          path: ["meses_credito"],
        })
      }
    }

    // Validar cuenta bancaria si pago es transferencia
    if (
      data.pago?.tipo_pago === "transferencia" &&
      !data.pago.cuenta_bancaria_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona la cuenta bancaria",
        path: ["pago", "cuenta_bancaria_id"],
      })
    }
    if (
      data.primer_abono?.tipo_pago === "transferencia" &&
      !data.primer_abono.cuenta_bancaria_id
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona la cuenta bancaria",
        path: ["primer_abono", "cuenta_bancaria_id"],
      })
    }
  })

export type VentaFormValues = z.infer<typeof ventaSchema>
export type VentaDetalleValues = z.infer<typeof ventaDetalleSchema>
