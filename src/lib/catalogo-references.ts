import type { SupabaseClient } from "@supabase/supabase-js"

interface CatalogoRef {
  table: string
  column: string
  label: string
}

export const CATALOGO_REFERENCES: Record<string, CatalogoRef[]> = {
  cat_genero: [{ table: "productos", column: "genero_id", label: "productos" }],
  cat_tamano: [{ table: "productos", column: "tamano_id", label: "productos" }],
  cat_presentacion: [{ table: "productos", column: "presentacion_id", label: "productos" }],
  cat_concentracion: [{ table: "productos", column: "concentracion_id", label: "productos" }],
  cat_tipo_perfume: [{ table: "productos", column: "tipo_perfume_id", label: "productos" }],
  cat_ciudad: [{ table: "clientes", column: "ciudad_id", label: "clientes" }],
  cat_cuenta_bancaria: [
    { table: "pagos", column: "cuenta_bancaria_id", label: "pagos" },
    { table: "gastos", column: "cuenta_bancaria_id", label: "gastos" },
  ],
  cat_categoria_gasto: [{ table: "gastos", column: "categoria_id", label: "gastos" }],
}

export async function checkReferences(
  supabase: SupabaseClient,
  catalogTable: string,
  itemId: string
): Promise<{ canDelete: boolean; usageMessage: string }> {
  const refs = CATALOGO_REFERENCES[catalogTable]
  if (!refs || refs.length === 0) {
    return { canDelete: true, usageMessage: "" }
  }

  const parts: string[] = []

  for (const ref of refs) {
    const { count, error } = await supabase
      .from(ref.table)
      .select("id", { count: "exact", head: true })
      .eq(ref.column, itemId)
    if (error) continue
    if (count && count > 0) {
      parts.push(`${count} ${ref.label}`)
    }
  }

  if (parts.length === 0) {
    return { canDelete: true, usageMessage: "" }
  }

  return {
    canDelete: false,
    usageMessage: `No se puede eliminar. En uso por ${parts.join(", ")}`,
  }
}

const PRODUCTO_REFERENCES: CatalogoRef[] = [
  { table: "stock_movimientos", column: "producto_id", label: "movimientos" },
  { table: "ventas_detalle", column: "producto_id", label: "ventas" },
  { table: "entradas_detalle", column: "producto_id", label: "entradas" },
  { table: "devoluciones_detalle", column: "producto_id", label: "devoluciones" },
]

export async function checkProductReferences(
  supabase: SupabaseClient,
  productoId: string
): Promise<{ canDelete: boolean; usageMessage: string }> {
  const parts: string[] = []

  for (const ref of PRODUCTO_REFERENCES) {
    const { count, error } = await supabase
      .from(ref.table)
      .select("id", { count: "exact", head: true })
      .eq(ref.column, productoId)
    if (error) continue
    if (count && count > 0) {
      parts.push(`${count} ${ref.label}`)
    }
  }

  if (parts.length === 0) {
    return { canDelete: true, usageMessage: "" }
  }

  return {
    canDelete: false,
    usageMessage: `No se puede eliminar. En uso por ${parts.join(", ")}`,
  }
}
