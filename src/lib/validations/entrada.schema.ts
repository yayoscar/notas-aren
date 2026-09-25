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

// Edición de una entrada ya registrada.
//
// No lleva precio_venta_contado / precio_venta_credito a propósito: editar una
// entrada no revierte ni reescribe los precios del producto. Los precios se
// fijan al registrar la entrada y se corrigen desde la ficha del producto.
export const entradaEditDetalleSchema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  cantidad: z.coerce.number().int().min(1, "Mínimo 1"),
  precio_unitario: z.coerce.number().min(0.01, "Costo requerido"),
})

export const entradaEditSchema = z.object({
  proveedor_id: z.string().uuid("Selecciona un proveedor"),
  fecha: z.string().min(1, "La fecha es requerida"),
  fecha_factura: z.string().nullable().optional(),
  numero_factura: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  detalles: z
    .array(entradaEditDetalleSchema)
    .min(1, "La entrada debe conservar al menos un producto"),
})

export type EntradaEditFormValues = z.infer<typeof entradaEditSchema>
