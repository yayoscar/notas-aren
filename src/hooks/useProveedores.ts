"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Proveedor, InsertTables, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export function useProveedores() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<Proveedor[]>({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proveedores")
        .select("*")
        .order("nombre")
      if (error) throw error
      return data as Proveedor[]
    },
  })

  const create = useMutation({
    mutationFn: async (values: InsertTables<"proveedores">) => {
      const { data, error } = await supabase.from("proveedores").insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] })
      toast.success("Proveedor creado")
    },
    onError: () => toast.error("Error al crear proveedor"),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: UpdateTables<"proveedores"> & { id: string }) => {
      const { data, error } = await supabase.from("proveedores").update(values).eq("id", id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proveedores"] })
      toast.success("Proveedor actualizado")
    },
    onError: () => toast.error("Error al actualizar proveedor"),
  })

  return { query, create, update }
}
