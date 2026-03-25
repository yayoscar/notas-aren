"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { SaldoFavor } from "@/lib/supabase/types"
import { toast } from "sonner"

export function useSaldosFavor(clienteId: string) {
  const supabase = createClient()

  return useQuery<SaldoFavor[]>({
    queryKey: ["saldos_favor", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saldos_favor")
        .select("*")
        .eq("cliente_id", clienteId)
        .gt("monto_restante", 0)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as SaldoFavor[]
    },
    enabled: !!clienteId,
  })
}

export function useTotalSaldoFavor(clienteId: string) {
  const { data: saldos } = useSaldosFavor(clienteId)
  return saldos?.reduce((sum, s) => sum + s.monto_restante, 0) ?? 0
}

export function useAplicarSaldo() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      saldo_favor_id: string
      monto: number
      cliente_id: string
    }) => {
      const { data: saldo, error: fetchErr } = await supabase
        .from("saldos_favor")
        .select("*")
        .eq("id", input.saldo_favor_id)
        .single()
      if (fetchErr) throw fetchErr

      if (input.monto > saldo.monto_restante) {
        throw new Error("El monto excede el saldo disponible")
      }

      const { error: updateErr } = await supabase
        .from("saldos_favor")
        .update({
          monto_restante: saldo.monto_restante - input.monto,
        })
        .eq("id", input.saldo_favor_id)
      if (updateErr) throw updateErr

      return { ...saldo, monto_restante: saldo.monto_restante - input.monto }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["saldos_favor", variables.cliente_id],
      })
      queryClient.invalidateQueries({ queryKey: ["saldos_favor"] })
      toast.success("Saldo aplicado exitosamente")
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Error al aplicar saldo"
      ),
  })
}
