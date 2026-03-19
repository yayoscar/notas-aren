"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { PrecioHistorico, OrigenPrecio } from "@/lib/supabase/types"
import { toast } from "sonner"

export function usePrecioActivo(productoId: string) {
  const supabase = createClient()

  return useQuery<PrecioHistorico | null>({
    queryKey: ["precios_historico", productoId, "activo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precios_historico")
        .select("*")
        .eq("producto_id", productoId)
        .eq("activo", true)
        .maybeSingle()
      if (error) throw error
      return data as PrecioHistorico | null
    },
    enabled: !!productoId,
  })
}

export function usePreciosHistorico(productoId: string) {
  const supabase = createClient()

  return useQuery<PrecioHistorico[]>({
    queryKey: ["precios_historico", productoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precios_historico")
        .select("*")
        .eq("producto_id", productoId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as PrecioHistorico[]
    },
    enabled: !!productoId,
  })
}

interface CrearPrecioInput {
  producto_id: string
  precio_compra: number
  precio_venta_contado: number
  precio_venta_credito: number
  origen: OrigenPrecio
  usuario_id?: string | null
}

export function useCrearPrecio() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CrearPrecioInput) => {
      // Deactivate current active price
      await supabase
        .from("precios_historico")
        .update({ activo: false })
        .eq("producto_id", input.producto_id)
        .eq("activo", true)

      // Insert new active price
      const { data, error } = await supabase
        .from("precios_historico")
        .insert({
          producto_id: input.producto_id,
          precio_compra: input.precio_compra,
          precio_venta_contado: input.precio_venta_contado,
          precio_venta_credito: input.precio_venta_credito,
          activo: true,
          origen: input.origen,
          usuario_id: input.usuario_id ?? null,
        })
        .select()
        .single()
      if (error) throw error

      // Sync prices back to productos table (cache)
      await supabase
        .from("productos")
        .update({
          precio_compra: input.precio_compra,
          precio_venta_contado: input.precio_venta_contado,
          precio_venta_credito: input.precio_venta_credito,
        })
        .eq("id", input.producto_id)

      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["precios_historico", variables.producto_id] })
      queryClient.invalidateQueries({ queryKey: ["precios_historico", variables.producto_id, "activo"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Precios actualizados")
    },
    onError: () => toast.error("Error al actualizar precios"),
  })
}
