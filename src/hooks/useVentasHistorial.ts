"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { VentaHistorial } from "@/lib/supabase/types"

export type VentaHistorialWithUsuario = VentaHistorial & {
  vendedores: { nombre: string } | null
}

export function useVentasHistorial(ventaId: string) {
  const supabase = createClient()

  return useQuery<VentaHistorialWithUsuario[]>({
    queryKey: ["ventas_historial", ventaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas_historial")
        .select("*, vendedores:usuario_id(nombre)")
        .eq("venta_id", ventaId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as VentaHistorialWithUsuario[]
    },
    enabled: !!ventaId,
  })
}
