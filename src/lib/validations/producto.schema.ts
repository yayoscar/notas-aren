import { z } from "zod"

export const setItemSchema = z.object({
  descripcion: z.string().min(1, "La descripción es requerida"),
  cantidad: z.number().int().min(1, "Mínimo 1"),
})

export const productoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  marca: z.string().min(1, "La marca es requerida"),
  sku: z.string().nullable().optional(),
  genero_id: z.string().nullable().optional(),
  tamano_id: z.string().nullable().optional(),
  presentacion_id: z.string().nullable().optional(),
  concentracion_id: z.string().nullable().optional(),
  tipo_perfume_id: z.string().nullable().optional(),
  proveedor_id: z.string().nullable().optional(),
  stock_minimo: z.number().int().min(0).nullable().optional(),
  imagen_url: z.string().nullable().optional(),
  set_items: z.array(setItemSchema).optional(),
})

export type ProductoFormValues = z.infer<typeof productoSchema>
export type SetItemValues = z.infer<typeof setItemSchema>
