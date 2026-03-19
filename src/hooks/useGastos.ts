"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Gasto } from "@/lib/supabase/types"
import { toast } from "sonner"

export type GastoWithRelations = Gasto & {
  cat_categoria_gasto: { nombre: string } | null
  vendedores: { nombre: string } | null
  cat_cuenta_bancaria: { alias: string } | null
}

export function useGastos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<GastoWithRelations[]>({
    queryKey: ["gastos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gastos")
        .select(
          `*, cat_categoria_gasto(nombre), vendedores(nombre), cat_cuenta_bancaria(alias)`
        )
        .order("fecha", { ascending: false })
      if (error) throw error
      return data as unknown as GastoWithRelations[]
    },
  })

  const create = useMutation({
    mutationFn: async (
      values: Omit<Gasto, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("gastos")
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data as Gasto
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos"] })
      toast.success("Gasto registrado exitosamente")
    },
    onError: () => toast.error("Error al registrar gasto"),
  })

  return { query, create }
}
