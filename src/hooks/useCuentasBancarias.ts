"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { CuentaBancaria } from "@/lib/supabase/types"
import { toast } from "sonner"

export function useCuentasBancarias() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<CuentaBancaria[]>({
    queryKey: ["cuentas_bancarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cat_cuenta_bancaria")
        .select("*")
        .order("alias")
      if (error) throw error
      return data as CuentaBancaria[]
    },
  })

  const activas = (query.data ?? []).filter((c) => c.activo)

  const create = useMutation({
    mutationFn: async (values: { alias: string; clabe: string }) => {
      const { data, error } = await supabase
        .from("cat_cuenta_bancaria")
        .insert(values)
        .select()
        .single()
      if (error) throw error
      return data as CuentaBancaria
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas_bancarias"] })
      toast.success("Cuenta bancaria creada")
    },
    onError: () => toast.error("Error al crear cuenta bancaria"),
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<CuentaBancaria> & { id: string }) => {
      const { data, error } = await supabase
        .from("cat_cuenta_bancaria")
        .update(values)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as CuentaBancaria
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cuentas_bancarias"] })
      toast.success("Cuenta bancaria actualizada")
    },
    onError: () => toast.error("Error al actualizar cuenta bancaria"),
  })

  return { query, activas, create, update }
}
