import { z } from "zod"

export const productoDevueltoSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  estado_devuelto: z.enum(["nuevo", "parcial"], {
    message: "Selecciona el estado del producto",
  }),
  precio_original: z.coerce.number().min(0),
  precio_depreciado: z.coerce.number().min(0).optional(),
  // Auxiliares
  _nombre: z.string().optional(),
  _cantidad_max: z.number().optional(),
})

export const productoNuevoSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  precio_unitario: z.coerce.number().min(0.01, "Precio requerido"),
  _nombre: z.string().optional(),
  _stock_actual: z.number().optional(),
})

const devolucionBaseSchema = z.object({
  venta_id: z.string().uuid(),
  tipo: z.enum(["devolucion", "cambio", "anulacion"], {
    message: "Selecciona el tipo de operación",
  }),
  productos_devueltos: z
    .array(productoDevueltoSchema)
    .min(1, "Selecciona al menos un producto a devolver"),
  productos_nuevos: z.array(productoNuevoSchema).optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  fecha_venta: z.string().min(1, "La fecha de venta es requerida"),
  motivo: z.string().min(10, "El motivo debe tener al menos 10 caracteres"),
  destino_monto: z
    .enum(["efectivo", "abono_credito"])
    .nullable()
    .optional(),
})

export const devolucionSchema = devolucionBaseSchema.superRefine(
  (data, ctx) => {
    // Validar política de 7 días
    const fechaVenta = new Date(data.fecha_venta)
    const fechaHoy = new Date(data.fecha)
    const diffMs = fechaHoy.getTime() - fechaVenta.getTime()
    const diffDias = diffMs / (1000 * 60 * 60 * 24)
    if (diffDias > 7) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Solo se permiten devoluciones dentro de los 7 días posteriores a la fecha de venta",
        path: ["fecha_venta"],
      })
    }

    // Si es anulación, todos los productos deben regresar completos (estado "nuevo")
    if (data.tipo === "anulacion") {
      data.productos_devueltos.forEach((p, i) => {
        if (p.estado_devuelto !== "nuevo") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Para anular la venta, todos los productos deben ser devueltos en estado completo",
            path: ["productos_devueltos", i, "estado_devuelto"],
          })
        }
      })
    }

    // Si es cambio, debe haber al menos un producto nuevo
    if (data.tipo === "cambio") {
      if (!data.productos_nuevos || data.productos_nuevos.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona al menos un producto nuevo para el cambio",
          path: ["productos_nuevos"],
        })
      }
    }

    // Productos parciales deben tener precio depreciado válido
    data.productos_devueltos.forEach((p, i) => {
      if (p.estado_devuelto === "parcial") {
        if (p.precio_depreciado === undefined || p.precio_depreciado <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Ingresa el valor depreciado del producto",
            path: ["productos_devueltos", i, "precio_depreciado"],
          })
        }
        if (
          p.precio_depreciado !== undefined &&
          p.precio_depreciado > p.precio_original
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "El precio depreciado no puede ser mayor al precio de venta",
            path: ["productos_devueltos", i, "precio_depreciado"],
          })
        }
      }
    })
  }
)

export type DevolucionFormValues = z.infer<typeof devolucionBaseSchema>
export type ProductoDevueltoValues = z.infer<typeof productoDevueltoSchema>
export type ProductoNuevoValues = z.infer<typeof productoNuevoSchema>
