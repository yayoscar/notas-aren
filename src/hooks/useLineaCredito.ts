"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { localDateToISO } from "@/lib/utils"

export function useLineaCreditoCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["linea_credito_cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, clientes(nombre, telefono), vendedores(nombre)")
        .eq("cliente_id", clienteId)
        .eq("estado", "activa")
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!clienteId,
  })
}

export function useLineasCreditoActivas() {
  const supabase = createClient()

  return useQuery({
    queryKey: ["lineas_credito_activas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, clientes(nombre, telefono)")
        .eq("estado", "activa")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCrearLineaCredito() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      cliente_id: string
      vendedor_id: string
      saldo_total: number
      meses_credito: number
      periodicidad: string
      fecha_inicio: string
      fecha_siguiente_pago: string
    }) => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .insert({
          cliente_id: input.cliente_id,
          vendedor_id: input.vendedor_id,
          saldo_total: input.saldo_total,
          meses_credito: input.meses_credito,
          periodicidad: input.periodicidad,
          fecha_inicio: localDateToISO(input.fecha_inicio),
          fecha_siguiente_pago: localDateToISO(input.fecha_siguiente_pago),
          estado: "activa",
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito_cliente", input.cliente_id] })
      toast.success("Línea de crédito creada")
    },
    onError: () => toast.error("Error al crear línea de crédito"),
  })
}

export function useAjustarPlanPagos() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      linea_credito_id: string
      meses_credito: number
      periodicidad: string
      fecha_siguiente_pago: string
    }) => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .update({
          meses_credito: input.meses_credito,
          periodicidad: input.periodicidad,
          fecha_siguiente_pago: localDateToISO(input.fecha_siguiente_pago),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.linea_credito_id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito_cliente"] })
      toast.success("Plan de pagos ajustado")
    },
    onError: () => toast.error("Error al ajustar plan de pagos"),
  })
}

export function useVentasDeLinea(lineaCreditoId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["ventas_linea", lineaCreditoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, folio, total, created_at")
        .eq("linea_credito_id", lineaCreditoId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!lineaCreditoId,
  })
}

export function useUltimoPagoLinea(lineaCreditoId: string) {
  const supabase = createClient()
  return useQuery({
    queryKey: ["ultimo_pago_linea", lineaCreditoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("fecha, monto")
        .eq("linea_credito_id", lineaCreditoId)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!lineaCreditoId,
  })
}

export function useLineasCreditoCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["lineas_credito_cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, vendedores(nombre)")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!clienteId,
  })
}

export function usePagosByLinea(lineaCreditoId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["pagos_linea", lineaCreditoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("*, vendedores(nombre), cat_cuenta_bancaria(alias, clabe)")
        .eq("linea_credito_id", lineaCreditoId)
        .order("fecha", { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!lineaCreditoId,
  })
}
