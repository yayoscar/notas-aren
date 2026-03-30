"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Venta, Pago } from "@/lib/supabase/types"
import { toast } from "sonner"

export type CreditoConSaldo = {
  id: string
  cliente_id: string
  saldo_total: number
  saldo_pagado: number
  saldo_pendiente: number
  meses_credito: number
  periodicidad: string
  fecha_inicio: string
  fecha_siguiente_pago: string | null
  fecha_cobro_especifica: string | null
  estado: string
  created_at: string
  linea_credito_id?: string // alias for id, for backward compat
  clientes: { nombre: string; telefono: string | null } | null
  vendedores: { nombre: string } | null
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
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, clientes(nombre, telefono), vendedores(nombre)")
        .eq("estado", "activa")
        .order("created_at", { ascending: false })
      if (error) throw error

      return (data ?? []).map((item) => ({
        ...item,
        saldo_pendiente: item.saldo_total - item.saldo_pagado,
        linea_credito_id: item.id,
      })) as CreditoConSaldo[]
    },
  })
}

export function useCreditosCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery<CreditoConSaldo[]>({
    queryKey: ["creditos_cliente", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lineas_credito")
        .select("*, clientes(nombre, telefono), vendedores(nombre)")
        .eq("cliente_id", clienteId)
        .eq("estado", "activa")
        .order("created_at", { ascending: false })
      if (error) throw error

      return (data ?? []).map((item) => ({
        ...item,
        saldo_pendiente: item.saldo_total - item.saldo_pagado,
        linea_credito_id: item.id,
      })) as CreditoConSaldo[]
    },
    enabled: !!clienteId,
  })
}

export function useCrearAbono() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      linea_credito_id: string
      venta_id?: string
      monto: number
      tipo_pago: string
      cuenta_bancaria_id?: string | null
      vendedor_id: string
      cliente_id: string
      fecha?: string
    }) => {
      // 1. Insertar el pago
      const { data, error } = await supabase
        .from("pagos")
        .insert({
          linea_credito_id: input.linea_credito_id,
          venta_id: input.venta_id ?? null,
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

      // 2. Actualizar saldo_pagado en la línea de crédito
      const { data: linea, error: lineaFetchError } = await supabase
        .from("lineas_credito")
        .select("saldo_total, saldo_pagado")
        .eq("id", input.linea_credito_id)
        .single()
      if (lineaFetchError) throw lineaFetchError

      const nuevoSaldoPagado = (linea.saldo_pagado ?? 0) + input.monto

      const updatePayload: Record<string, unknown> = {
        saldo_pagado: nuevoSaldoPagado,
        updated_at: new Date().toISOString(),
      }

      // 3. Si ya se cubrió el saldo total, marcar como liquidada
      if (nuevoSaldoPagado >= linea.saldo_total) {
        updatePayload.estado = "liquidada"
      }

      const { error: updateError } = await supabase
        .from("lineas_credito")
        .update(updatePayload)
        .eq("id", input.linea_credito_id)
      if (updateError) throw updateError

      return data as Pago
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["pagos"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_activos"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["cobranza"] })
      queryClient.invalidateQueries({ queryKey: ["cobranza_v2"] })
      queryClient.invalidateQueries({ queryKey: ["cobranza_agenda"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["pagos_linea"] })
      toast.success("Abono registrado exitosamente")
    },
    onError: () => toast.error("Error al registrar abono"),
  })
}
