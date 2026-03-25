"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Devolucion, DevolucionDetalle } from "@/lib/supabase/types"

export type DevolucionDetalleWithProducto = DevolucionDetalle & {
  productos: { nombre: string; sku: string | null } | null
}

export type DevolucionWithRelations = Devolucion & {
  vendedores: { nombre: string } | null
  devoluciones_detalle: DevolucionDetalleWithProducto[]
}

export function useDevoluciones(ventaId?: string) {
  const supabase = createClient()

  return useQuery<DevolucionWithRelations[]>({
    queryKey: ["devoluciones", ventaId],
    queryFn: async () => {
      let query = supabase
        .from("devoluciones")
        .select(
          `*, vendedores(nombre), devoluciones_detalle(*, productos(nombre, sku))`
        )
        .order("created_at", { ascending: false })

      if (ventaId) {
        query = query.eq("venta_id", ventaId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as DevolucionWithRelations[]
    },
    enabled: ventaId ? !!ventaId : true,
  })
}

