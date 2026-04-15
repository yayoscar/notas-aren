"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export interface TipoDescuento {
  id: string
  nombre: string
  activo: boolean
}

const TABLE = "cat_tipo_descuento"

export function useTiposDescuento() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<TipoDescuento[]>({
    queryKey: [TABLE],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("nombre")
      if (error) throw error
      return data as TipoDescuento[]
    },
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [TABLE] })
    queryClient.invalidateQueries({ queryKey: [TABLE, "activos"] })
  }

  const create = useMutation({
    mutationFn: async ({ nombre }: { nombre: string }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ nombre, activo: true })
        .select()
        .single()
      if (error) throw error
      return data as TipoDescuento
    },
    onSuccess: () => {
      invalidate()
      toast.success("Tipo de descuento creado")
    },
    onError: (e: Error) => toast.error(e.message || "Error al crear"),
  })

  const update = useMutation({
    mutationFn: async ({ id, nombre }: { id: string; nombre: string }) => {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ nombre })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as TipoDescuento
    },
    onSuccess: () => {
      invalidate()
      toast.success("Tipo de descuento actualizado")
    },
    onError: () => toast.error("Error al actualizar"),
  })

  // Soft-delete: marca activo = false en lugar de borrar para preservar
  // la trazabilidad histórica en ventas_detalle_descuento.
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ activo: false })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Tipo de descuento desactivado")
    },
    onError: () => toast.error("Error al desactivar"),
  })

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from(TABLE)
        .update({ activo: true })
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      toast.success("Tipo de descuento reactivado")
    },
    onError: () => toast.error("Error al reactivar"),
  })

  return { query, create, update, remove, reactivate }
}

export function useTiposDescuentoActivos() {
  const supabase = createClient()

  return useQuery<TipoDescuento[]>({
    queryKey: [TABLE, "activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("activo", true)
        .order("nombre")
      if (error) throw error
      return data as TipoDescuento[]
    },
  })
}
