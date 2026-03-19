import { z } from "zod"

export const entradaDetalleSchema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  precio_unitario: z.coerce.number().min(0.01, "Precio requerido"),
  precio_venta_contado: z.coerce.number().min(0, "Debe ser >= 0"),
  precio_venta_credito: z.coerce.number().min(0, "Debe ser >= 0"),
})

export const entradaSchema = z.object({
  proveedor_id: z.string().uuid("Selecciona un proveedor"),
  fecha: z.string().min(1, "La fecha es requerida"),
  fecha_factura: z.string().nullable().optional(),
  numero_factura: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  detalles: z.array(entradaDetalleSchema).min(1, "Agrega al menos un producto"),
})

export type EntradaFormValues = z.infer<typeof entradaSchema>
