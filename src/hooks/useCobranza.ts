"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  lastDayOfMonth,
  setDate,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreditoCobranza = {
  id: string
  cliente_id: string
  saldo_total: number
  saldo_pagado: number
  saldo_pendiente: number
  saldo_restante: number
  meses_credito: number
  periodicidad: string
  fecha_inicio: string
  fecha_siguiente_pago: string | null
  fecha_cobro_especifica: string | null
  estado: string
  created_at: string
  clientes: { nombre: string; telefono: string | null; ciudad: string | null } | null
  vendedores: { nombre: string } | null
  vendedor_id: string | null
  atendido: boolean
  periodo_inicio: string
  periodo_fin: string
  abono_en_periodo: boolean
  ultimo_pago_fecha: string | null
  ultimo_pago_monto: number | null
  cuota_programada: number
  estado_periodo: "al_dia" | "atrasado" | "sin_abonos"
}

export type RangoTipo = "semana" | "quincena" | "mes" | "personalizado"

// ---------------------------------------------------------------------------
// Range helpers
// ---------------------------------------------------------------------------

export function calcularRangoPredefinido(tipo: RangoTipo, referencia: Date = new Date()): { inicio: string; fin: string } {
  switch (tipo) {
    case "semana": {
      const inicio = startOfWeek(referencia, { weekStartsOn: 1 })
      const fin = endOfWeek(referencia, { weekStartsOn: 1 })
      return { inicio: format(inicio, "yyyy-MM-dd"), fin: format(fin, "yyyy-MM-dd") }
    }
    case "quincena": {
      const day = referencia.getDate()
      if (day <= 15) {
        const inicio = startOfMonth(referencia)
        const fin = setDate(referencia, 15)
        return { inicio: format(inicio, "yyyy-MM-dd"), fin: format(fin, "yyyy-MM-dd") }
      }
      const inicio = setDate(referencia, 16)
      const fin = lastDayOfMonth(referencia)
      return { inicio: format(inicio, "yyyy-MM-dd"), fin: format(fin, "yyyy-MM-dd") }
    }
    case "mes": {
      const inicio = startOfMonth(referencia)
      const fin = endOfMonth(referencia)
      return { inicio: format(inicio, "yyyy-MM-dd"), fin: format(fin, "yyyy-MM-dd") }
    }
    default:
      return { inicio: format(referencia, "yyyy-MM-dd"), fin: format(referencia, "yyyy-MM-dd") }
  }
}

export function formatRango(inicio: string, fin: string): string {
  const i = parseISO(inicio)
  const f = parseISO(fin)
  return `${format(i, "dd MMM")} – ${format(f, "dd MMM yyyy")}`
}

// Keep backward compat exports
export type Frecuencia = "semanal" | "quincenal" | "mensual"
export type Periodo = { inicio: Date; fin: Date }

export function calcularPeriodoActual(frecuencia: Frecuencia, referencia: Date = new Date()): Periodo {
  const r = frecuencia === "semanal" ? "semana" : frecuencia === "quincenal" ? "quincena" : "mes"
  const { inicio, fin } = calcularRangoPredefinido(r as RangoTipo, referencia)
  return { inicio: parseISO(inicio), fin: parseISO(fin) }
}

export function formatPeriodo(periodo: Periodo): string {
  return `${format(periodo.inicio, "dd MMM")} – ${format(periodo.fin, "dd MMM yyyy")}`
}

// ---------------------------------------------------------------------------
// Main Query
// ---------------------------------------------------------------------------

export function useCreditosCobranzaV2(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery<CreditoCobranza[]>({
    queryKey: ["cobranza_v2", fechaInicio, fechaFin],
    queryFn: async () => {
      // 1. Fetch active lineas_credito with pending balance
      const { data: lineas, error: lineasError } = await supabase
        .from("lineas_credito")
        .select("*, clientes(nombre, telefono, cat_ciudad(nombre)), vendedores(nombre)")
        .eq("estado", "activa")
        .order("fecha_siguiente_pago", { ascending: true, nullsFirst: false })
      if (lineasError) throw lineasError

      if (!lineas || lineas.length === 0) return []

      const lineaIds = lineas.map((l) => l.id)

      // 2. Fetch all pagos for these lineas to find ultimo pago and detect abonos in period
      const { data: allPagos, error: pagosError } = await supabase
        .from("pagos")
        .select("linea_credito_id, monto, fecha")
        .in("linea_credito_id", lineaIds)
        .order("fecha", { ascending: false })
      if (pagosError) throw pagosError

      // 3. Fetch attendance records for this period
      const { data: seguimientos, error: segError } = await supabase
        .from("cobranza_seguimiento")
        .select("*")
        .eq("periodo_inicio", fechaInicio)
        .in("linea_credito_id", lineaIds)
      if (segError) throw segError

      const segMap = new Map((seguimientos ?? []).map((s) => [s.linea_credito_id, s]))

      // Group pagos by linea
      const pagosByLinea = new Map<string, { fecha: string; monto: number }[]>()
      for (const p of allPagos ?? []) {
        if (!p.linea_credito_id) continue
        const arr = pagosByLinea.get(p.linea_credito_id) ?? []
        arr.push({ fecha: p.fecha, monto: p.monto })
        pagosByLinea.set(p.linea_credito_id, arr)
      }

      const rangoInicio = parseISO(fechaInicio)
      const rangoFin = parseISO(fechaFin)

      return lineas
        .map((l) => {
          const saldoPendiente = l.saldo_total - l.saldo_pagado
          if (saldoPendiente <= 0) return null

          // Check if fecha_siguiente_pago falls within range
          if (!l.fecha_siguiente_pago) return null
          try {
            const fsp = parseISO(l.fecha_siguiente_pago)
            // Include if fecha_siguiente_pago <= rangoFin (includes past due)
            if (fsp > rangoFin) return null
          } catch {
            return null
          }

          // Calculate cuota
          const factor = l.periodicidad === "semanal" ? 4 : l.periodicidad === "quincenal" ? 2 : 1
          const pagosRestantes = Math.max(1, l.meses_credito * factor)
          const cuota = Math.ceil((saldoPendiente / pagosRestantes) * 100) / 100

          // Find ultimo pago
          const pagos = pagosByLinea.get(l.id) ?? []
          const ultimoPago = pagos.length > 0 ? pagos[0] : null // already sorted desc

          // Determine estado_periodo
          let estadoPeriodo: "al_dia" | "atrasado" | "sin_abonos" = "sin_abonos"
          if (ultimoPago) {
            try {
              const fechaUltimo = parseISO(ultimoPago.fecha)
              if (isWithinInterval(fechaUltimo, { start: rangoInicio, end: rangoFin })) {
                estadoPeriodo = "al_dia"
              } else {
                estadoPeriodo = "atrasado"
              }
            } catch {
              estadoPeriodo = "atrasado"
            }
          }

          // Check abono in period
          const abonoEnPeriodo = pagos.some((p) => {
            try {
              return isWithinInterval(parseISO(p.fecha), { start: rangoInicio, end: rangoFin })
            } catch {
              return false
            }
          })

          const seg = segMap.get(l.id)

          return {
            id: l.id,
            cliente_id: l.cliente_id,
            saldo_total: l.saldo_total,
            saldo_pagado: l.saldo_pagado,
            saldo_pendiente: saldoPendiente,
            saldo_restante: saldoPendiente,
            meses_credito: l.meses_credito,
            periodicidad: l.periodicidad,
            fecha_inicio: l.fecha_inicio,
            fecha_siguiente_pago: l.fecha_siguiente_pago,
            fecha_cobro_especifica: l.fecha_cobro_especifica ?? null,
            estado: l.estado,
            created_at: l.created_at,
            clientes: l.clientes
              ? {
                  nombre: (l.clientes as Record<string, unknown>).nombre as string,
                  telefono: (l.clientes as Record<string, unknown>).telefono as string | null,
                  ciudad: ((l.clientes as Record<string, unknown>).cat_ciudad as { nombre: string } | null)?.nombre ?? null,
                }
              : null,
            vendedores: l.vendedores
              ? { nombre: (l.vendedores as Record<string, unknown>).nombre as string }
              : null,
            vendedor_id: l.vendedor_id ?? null,
            atendido: seg?.atendido ?? false,
            periodo_inicio: fechaInicio,
            periodo_fin: fechaFin,
            abono_en_periodo: abonoEnPeriodo,
            ultimo_pago_fecha: ultimoPago?.fecha ?? null,
            ultimo_pago_monto: ultimoPago?.monto ?? null,
            cuota_programada: cuota,
            estado_periodo: estadoPeriodo,
          } as CreditoCobranza
        })
        .filter((c): c is CreditoCobranza => c !== null)
        .sort((a, b) => {
          const fa = a.fecha_siguiente_pago ?? "9999"
          const fb = b.fecha_siguiente_pago ?? "9999"
          return fa.localeCompare(fb)
        })
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

// Keep old hooks for backward compat (used by existing components)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCreditosCobranza(frecuencia: Frecuencia, _offset: number = 0) {
  const rango = calcularRangoPredefinido(
    frecuencia === "semanal" ? "semana" : frecuencia === "quincenal" ? "quincena" : "mes"
  )
  const result = useCreditosCobranzaV2(rango.inicio, rango.fin)
  const periodo = calcularPeriodoActual(frecuencia)
  return { ...result, periodo, periodoInicioStr: rango.inicio, periodoFinStr: rango.fin }
}

export function useAgendaDiaria(fecha: string) {
  return useCreditosCobranzaV2(fecha, fecha)
}

// ---------------------------------------------------------------------------
// Mutations (kept as-is)
// ---------------------------------------------------------------------------

export function useMarcarAtendido() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      linea_credito_id: string
      periodo_inicio: string
      periodo_fin: string
      frecuencia: string
      atendido: boolean
    }) => {
      const { data, error } = await supabase
        .from("cobranza_seguimiento")
        .upsert(
          {
            linea_credito_id: input.linea_credito_id,
            periodo_inicio: input.periodo_inicio,
            periodo_fin: input.periodo_fin,
            frecuencia: input.frecuencia,
            atendido: input.atendido,
            fecha_atendido: input.atendido ? new Date().toISOString() : null,
          },
          { onConflict: "linea_credito_id,periodo_inicio" }
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobranza_v2"] })
    },
    onError: () => toast.error("Error al actualizar seguimiento"),
  })
}

export function useAsignarFechaCobro() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      linea_credito_id: string
      fecha_cobro_especifica: string | null
    }) => {
      const { error } = await supabase
        .from("lineas_credito")
        .update({ fecha_cobro_especifica: input.fecha_cobro_especifica })
        .eq("id", input.linea_credito_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobranza_v2"] })
      toast.success("Fecha de cobro asignada")
    },
    onError: () => toast.error("Error al asignar fecha de cobro"),
  })
}
