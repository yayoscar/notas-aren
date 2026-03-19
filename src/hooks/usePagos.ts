"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Venta, Pago } from "@/lib/supabase/types"
import { toast } from "sonner"

export type CreditoConSaldo = Venta & {
  clientes: { nombre: string; telefono: string } | null
  vendedores: { nombre: string } | null
  total_abonado: number
  saldo_restante: number
}

export function usePagosByVenta(ventaId: string) {
  const supabase = createClient()

  return useQuery<Pago[]>({
    queryKey: ["pagos", ventaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("*")
        .eq("venta_id", ventaId)
        .order("fecha", { ascending: true })
      if (error) throw error
      return data as Pago[]
    },
    enabled: !!ventaId,
  })
}

export function useCreditosActivos() {
  const supabase = createClient()

  return useQuery<CreditoConSaldo[]>({
    queryKey: ["creditos_activos"],
    queryFn: async () => {
      // Obtener créditos activos
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(`*, clientes(nombre, telefono), vendedores(nombre)`)
        .eq("tipo_venta", "credito")
        .eq("estado_credito", "activo")
        .order("created_at", { ascending: false })
      if (ventasError) throw ventasError

      // Obtener pagos para cada crédito
      const ventaIds = (ventas ?? []).map((v) => v.id)
      if (ventaIds.length === 0) return []

      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select("venta_id, monto")
        .in("venta_id", ventaIds)
      if (pagosError) throw pagosError

      // Calcular saldos
      const pagosPorVenta = (pagos ?? []).reduce(
        (acc, p) => {
          acc[p.venta_id] = (acc[p.venta_id] || 0) + p.monto
          return acc
        },
        {} as Record<string, number>
      )

      return (ventas ?? []).map((v) => {
        const totalAbonado = pagosPorVenta[v.id] || 0
        return {
          ...v,
          total_abonado: totalAbonado,
          saldo_restante: v.total - totalAbonado,
        } as CreditoConSaldo
      })
    },
  })
}

export function useCreditosCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery<CreditoConSaldo[]>({
    queryKey: ["creditos_cliente", clienteId],
    queryFn: async () => {
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(`*, clientes(nombre, telefono), vendedores(nombre)`)
        .eq("tipo_venta", "credito")
        .eq("estado_credito", "activo")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
      if (ventasError) throw ventasError

      const ventaIds = (ventas ?? []).map((v) => v.id)
      if (ventaIds.length === 0) return []

      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select("venta_id, monto")
        .in("venta_id", ventaIds)
      if (pagosError) throw pagosError

      const pagosPorVenta = (pagos ?? []).reduce(
        (acc, p) => {
          acc[p.venta_id] = (acc[p.venta_id] || 0) + p.monto
          return acc
        },
        {} as Record<string, number>
      )

      return (ventas ?? []).map((v) => {
        const totalAbonado = pagosPorVenta[v.id] || 0
        return {
          ...v,
          total_abonado: totalAbonado,
          saldo_restante: v.total - totalAbonado,
        } as CreditoConSaldo
      })
    },
    enabled: !!clienteId,
  })
}

export function useCrearAbono() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      venta_id: string
      monto: number
      tipo_pago: string
      cuenta_bancaria_id?: string | null
      vendedor_id: string
      cliente_id: string
      fecha?: string
    }) => {
      const { data, error } = await supabase
        .from("pagos")
        .insert({
          venta_id: input.venta_id,
          monto: input.monto,
          tipo_pago: input.tipo_pago,
          cuenta_bancaria_id: input.cuenta_bancaria_id ?? null,
          vendedor_id: input.vendedor_id,
          cliente_id: input.cliente_id,
          fecha: input.fecha ?? new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data as Pago
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["pagos"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_activos"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Abono registrado exitosamente")
    },
    onError: () => toast.error("Error al registrar abono"),
  })
}
