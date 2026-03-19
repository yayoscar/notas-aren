"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Cliente, InsertTables, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export type ClienteWithRelations = Cliente & {
  cat_ciudad: { nombre: string } | null
  referido_por: { nombre: string } | null
}

export function useClientes() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<ClienteWithRelations[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          cat_ciudad(nombre),
          referido_por:clientes!cliente_referido_id(nombre)
        `)
        .order("nombre")
      if (error) throw error
      return data as unknown as ClienteWithRelations[]
    },
  })

  const create = useMutation({
    mutationFn: async (values: InsertTables<"clientes">) => {
      const { data, error } = await supabase.from("clientes").insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success("Cliente creado")
    },
    onError: () => toast.error("Error al crear cliente"),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: UpdateTables<"clientes"> & { id: string }) => {
      const { data, error } = await supabase.from("clientes").update(values).eq("id", id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success("Cliente actualizado")
    },
    onError: () => toast.error("Error al actualizar cliente"),
  })

  return { query, create, update }
}

export function useCliente(id: string) {
  const supabase = createClient()

  return useQuery<ClienteWithRelations>({
    queryKey: ["clientes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          cat_ciudad(nombre),
          referido_por:clientes!cliente_referido_id(nombre)
        `)
        .eq("id", id)
        .single()
      if (error) throw error
      return data as unknown as ClienteWithRelations
    },
    enabled: !!id,
  })
}

export function useReferidos(clienteId: string) {
  const supabase = createClient()

  return useQuery<Cliente[]>({
    queryKey: ["clientes", clienteId, "referidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("cliente_referido_id", clienteId)
        .order("nombre")
      if (error) throw error
      return data as Cliente[]
    },
    enabled: !!clienteId,
  })
}
