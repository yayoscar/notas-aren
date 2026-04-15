import { z } from "zod"

export const descuentoDetalleSchema = z.object({
  tipo_descuento_id: z.string().uuid("Selecciona un tipo de descuento"),
  porcentaje: z.coerce.number().int().min(0).max(100),
  precio_original: z.coerce.number().min(0),
})

export const ventaDetalleSchema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  precio_unitario: z.coerce.number().min(0, "Precio no puede ser negativo"),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  // Descuento opcional por ítem (se persiste en ventas_detalle_descuento)
  descuento: descuentoDetalleSchema.nullable().optional(),
  // Campos auxiliares (no se envían a la BD)
  _nombre: z.string().optional(),
  _marca: z.string().optional(),
  _genero: z.string().optional(),
  _sku: z.string().nullable().optional(),
  _stock_actual: z.number().optional(),
  _precio_minimo: z.number().optional(),
  _estado_producto: z.string().optional(),
  _porcentaje_parcial: z.number().optional(),
  _precio_padre: z.number().optional(),
})

export type DescuentoDetalleValues = z.infer<typeof descuentoDetalleSchema>

export const pagoInlineSchema = z.object({
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  tipo_pago: z.enum(["efectivo", "transferencia", "retiro_sin_tarjeta"], {
    message: "Selecciona el tipo de pago",
  }),
  cuenta_bancaria_id: z.string().uuid().nullable().optional(),
})

const ventaBaseSchema = z.object({
  cliente_id: z.string().uuid("Selecciona un cliente"),
  tipo_venta: z.enum(["contado", "credito"], {
    message: "Selecciona el tipo de venta",
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

export const ventaSchema = ventaBaseSchema.superRefine((data, ctx) => {
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

export type VentaFormValues = z.infer<typeof ventaBaseSchema>
export type VentaDetalleValues = z.infer<typeof ventaDetalleSchema>

// Schema para edición de ventas
const ventaEditBaseSchema = z.object({
  venta_id: z.string().uuid(),
  detalles: z
    .array(ventaDetalleSchema)
    .min(1, "Agrega al menos un producto"),
  motivo_edicion: z.string().min(1, "El motivo de edición es requerido"),
  // Total ya pagado (para validación en créditos)
  _total_pagado: z.number().optional(),
})

export const ventaEditSchema = ventaEditBaseSchema.superRefine((data, ctx) => {
  // Si hay pagos, el nuevo total no puede ser menor que lo pagado
  if (data._total_pagado && data._total_pagado > 0) {
    const nuevoTotal = data.detalles.reduce(
      (sum, d) => sum + d.precio_unitario * d.cantidad,
      0
    )
    if (nuevoTotal < data._total_pagado) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `El nuevo total no puede ser menor que lo ya pagado ($${data._total_pagado.toFixed(2)})`,
        path: ["detalles"],
      })
    }
  }
})

export type VentaEditFormValues = z.infer<typeof ventaEditBaseSchema>
