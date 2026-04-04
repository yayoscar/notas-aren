"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { SetDetalle } from "@/lib/supabase/types"

export function useSetDetalle(productoId: string | undefined) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<SetDetalle[]>({
    queryKey: ["set_detalle", productoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("set_detalle")
        .select("*")
        .eq("producto_id", productoId!)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true })
      if (error) throw error
      return data as SetDetalle[]
    },
    enabled: !!productoId,
  })

  const sync = useMutation({
    mutationFn: async (input: { productoId: string; items: { descripcion: string; cantidad: number }[] }) => {
      // Borrar existentes
      const { error: deleteError } = await supabase
        .from("set_detalle")
        .delete()
        .eq("producto_id", input.productoId)
      if (deleteError) throw deleteError

      // Insertar nuevos
      if (input.items.length > 0) {
        const rows = input.items.map((item, idx) => ({
          producto_id: input.productoId,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          orden: idx,
        }))
        const { error: insertError } = await supabase.from("set_detalle").insert(rows)
        if (insertError) throw insertError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["set_detalle", productoId] })
    },
    onError: () => toast.error("Error al guardar artículos del set"),
  })

  const deleteAll = useMutation({
    mutationFn: async (prodId: string) => {
      const { error } = await supabase
        .from("set_detalle")
        .delete()
        .eq("producto_id", prodId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["set_detalle", productoId] })
    },
    onError: () => toast.error("Error al eliminar artículos del set"),
  })

  return { query, sync, deleteAll }
}
