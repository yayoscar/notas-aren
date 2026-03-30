import { z } from "zod"
import type { ColumnDef } from "@/lib/import-utils"

export const importProductoRowSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido"),
  marca: z.string().min(1, "Marca es requerida"),
  precio_compra: z.coerce.number().positive("Precio compra debe ser positivo"),
  precio_venta_contado: z.coerce.number().positive("Precio contado debe ser positivo"),
  precio_venta_credito: z.coerce.number().positive("Precio crédito debe ser positivo"),
  stock_inicial: z.coerce.number().int().positive("Stock debe ser entero positivo"),
})

export type ImportProductoRow = z.infer<typeof importProductoRowSchema>

export const PRODUCTO_TEMPLATE_COLUMNS: ColumnDef[] = [
  { key: "nombre", label: "Nombre", required: true },
  { key: "marca", label: "Marca", required: true },
  { key: "precio_compra", label: "Precio Compra", required: true },
  { key: "precio_venta_contado", label: "Precio Venta Contado", required: true },
  { key: "precio_venta_credito", label: "Precio Venta Crédito", required: true },
  { key: "stock_inicial", label: "Stock Inicial", required: true },
]

export const PRODUCTO_SAMPLE_ROWS = [
  {
    nombre: "Perfume Floral 100ml",
    marca: "Aren",
    precio_compra: 450,
    precio_venta_contado: 850,
    precio_venta_credito: 950,
    stock_inicial: 10,
  },
  {
    nombre: "Loción Amaderada 50ml",
    marca: "Aren",
    precio_compra: 250,
    precio_venta_contado: 450,
    precio_venta_credito: 500,
    stock_inicial: 5,
  },
]
