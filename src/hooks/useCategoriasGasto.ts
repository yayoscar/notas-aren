"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { CategoriaGasto } from "@/lib/supabase/types"
import { toast } from "sonner"

export function useCategoriasGasto() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<CategoriaGasto[]>({
    queryKey: ["categorias_gasto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cat_categoria_gasto")
        .select("*")
        .order("nombre")
      if (error) throw error
      return data as CategoriaGasto[]
    },
  })

  const activas = (query.data ?? []).filter((c) => c.activo)

  const create = useMutation({
    mutationFn: async (values: { nombre: string }) => {
      const { data, error } = await supabase
        .from("cat_categoria_gasto")
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data as CategoriaGasto
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias_gasto"] })
      toast.success("Categoría creada")
    },
    onError: () => toast.error("Error al crear categoría"),
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<CategoriaGasto> & { id: string }) => {
      const { data, error } = await supabase
        .from("cat_categoria_gasto")
        .update(values)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as CategoriaGasto
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categorias_gasto"] })
      toast.success("Categoría actualizada")
    },
    onError: () => toast.error("Error al actualizar categoría"),
  })

  return { query, activas, create, update }
}
