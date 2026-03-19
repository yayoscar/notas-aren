"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

type CatalogoTable =
  | "cat_genero"
  | "cat_tamano"
  | "cat_presentacion"
  | "cat_concentracion"
  | "cat_tipo_perfume"
  | "cat_ciudad"

export interface CatalogoRow {
  id: string
  nombre?: string
  ml?: number
  etiqueta?: string
  activo: boolean
}

export function useCatalogo(table: CatalogoTable) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<CatalogoRow[]>({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select("*")
      if (error) throw error
      return data as CatalogoRow[]
    },
  })

  const create = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { data, error } = await supabase.from(table).insert(values).select().single()
      if (error) throw error
      return data as CatalogoRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success("Registro creado")
    },
    onError: () => toast.error("Error al crear registro"),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Record<string, unknown>) => {
      const { data, error } = await supabase.from(table).update(values).eq("id", id).select().single()
      if (error) throw error
      return data as CatalogoRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] })
      toast.success("Registro actualizado")
    },
    onError: () => toast.error("Error al actualizar"),
  })

  return { query, create, update }
}
