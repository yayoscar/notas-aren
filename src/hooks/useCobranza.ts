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
  addWeeks,
  addMonths,
  subWeeks,
  subMonths,
  setDate,
  isWithinInterval,
  parseISO,
  format,
} from "date-fns"
import type { CreditoConSaldo } from "@/hooks/usePagos"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreditoCobranza = CreditoConSaldo & {
  clientes: { nombre: string; telefono: string; ciudad: string | null } | null
  atendido: boolean
  fecha_cobro_especifica: string | null
  periodo_inicio: string
  periodo_fin: string
  abono_en_periodo: boolean
}

export type Periodo = { inicio: Date; fin: Date }
export type Frecuencia = "semanal" | "quincenal" | "mensual"

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function calcularPeriodoActual(
  frecuencia: Frecuencia,
  referencia: Date = new Date()
): Periodo {
  switch (frecuencia) {
    case "semanal":
      return {
        inicio: startOfWeek(referencia, { weekStartsOn: 1 }),
        fin: endOfWeek(referencia, { weekStartsOn: 1 }),
      }
    case "quincenal": {
      const day = referencia.getDate()
      if (day <= 14) {
        const inicio = startOfMonth(referencia)
        const fin = setDate(referencia, 14)
        return { inicio, fin }
      }
      const inicio = setDate(referencia, 15)
      const fin = lastDayOfMonth(referencia)
      return { inicio, fin }
    }
    case "mensual":
      return {
        inicio: startOfMonth(referencia),
        fin: endOfMonth(referencia),
      }
  }
}

export function calcularPeriodoConOffset(
  frecuencia: Frecuencia,
  offset: number
): Periodo {
  let ref = new Date()
  if (offset !== 0) {
    switch (frecuencia) {
      case "semanal":
        ref = offset > 0 ? addWeeks(ref, offset) : subWeeks(ref, Math.abs(offset))
        break
      case "quincenal": {
        // Move by half-months
        for (let i = 0; i < Math.abs(offset); i++) {
          const day = ref.getDate()
          if (offset > 0) {
            if (day <= 14) {
              ref = setDate(ref, 15)
            } else {
              ref = setDate(addMonths(ref, 1), 1)
            }
          } else {
            if (day >= 15) {
              ref = setDate(ref, 1)
            } else {
              ref = setDate(subMonths(ref, 1), 15)
            }
          }
        }
        break
      }
      case "mensual":
        ref = offset > 0 ? addMonths(ref, offset) : subMonths(ref, Math.abs(offset))
        break
    }
  }
  return calcularPeriodoActual(frecuencia, ref)
}

export function formatPeriodo(periodo: Periodo): string {
  return `${format(periodo.inicio, "dd MMM")} – ${format(periodo.fin, "dd MMM yyyy")}`
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCreditosCobranza(
  frecuencia: Frecuencia,
  offset: number = 0
) {
  const supabase = createClient()
  const periodo = calcularPeriodoConOffset(frecuencia, offset)
  const periodoInicioStr = format(periodo.inicio, "yyyy-MM-dd")
  const periodoFinStr = format(periodo.fin, "yyyy-MM-dd")

  const query = useQuery<CreditoCobranza[]>({
    queryKey: ["cobranza", frecuencia, periodoInicioStr],
    queryFn: async () => {
      // 1. Fetch active credits with matching frequency
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(`*, clientes(nombre, telefono, ciudad_id)`)
        .eq("tipo_venta", "credito")
        .eq("estado_credito", "activo")
        .eq("periodicidad", frecuencia)
        .order("created_at", { ascending: false })
      if (ventasError) throw ventasError

      const ventaIds = (ventas ?? []).map((v) => v.id)
      if (ventaIds.length === 0) return []

      // 2. Fetch payments to compute balances
      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select("venta_id, monto, fecha")
        .in("venta_id", ventaIds)
      if (pagosError) throw pagosError

      // 3. Fetch attendance records for this period
      const { data: seguimientos, error: segError } = await supabase
        .from("cobranza_seguimiento")
        .select("*")
        .eq("periodo_inicio", periodoInicioStr)
        .in("venta_id", ventaIds)
      if (segError) throw segError

      // 4. Fetch city names for display
      const ciudadIds = Array.from(
        new Set((ventas ?? []).map((v) => v.clientes?.ciudad_id).filter(Boolean))
      )
      let ciudadMap: Record<string, string> = {}
      if (ciudadIds.length > 0) {
        const { data: ciudades } = await supabase
          .from("cat_ciudad")
          .select("id, nombre")
          .in("id", ciudadIds)
        ciudadMap = (ciudades ?? []).reduce(
          (acc, c) => ({ ...acc, [c.id]: c.nombre }),
          {} as Record<string, string>
        )
      }

      // 5. Compute balances & merge
      const pagosPorVenta: Record<string, number> = {}
      const pagosEnPeriodo = new Set<string>()
      for (const p of pagos ?? []) {
        pagosPorVenta[p.venta_id] = (pagosPorVenta[p.venta_id] || 0) + p.monto
        try {
          const fechaPago = parseISO(p.fecha)
          if (
            isWithinInterval(fechaPago, {
              start: periodo.inicio,
              end: periodo.fin,
            })
          ) {
            pagosEnPeriodo.add(p.venta_id)
          }
        } catch {
          // skip invalid dates
        }
      }

      const segMap = new Map(
        (seguimientos ?? []).map((s) => [s.venta_id, s])
      )

      return (ventas ?? [])
        .map((v) => {
          const totalAbonado = pagosPorVenta[v.id] || 0
          const saldoRestante = v.total - totalAbonado
          const seg = segMap.get(v.id)
          const ciudadNombre = v.clientes?.ciudad_id
            ? ciudadMap[v.clientes.ciudad_id] ?? null
            : null
          return {
            ...v,
            clientes: v.clientes
              ? {
                  nombre: v.clientes.nombre,
                  telefono: v.clientes.telefono,
                  ciudad: ciudadNombre,
                }
              : null,
            total_abonado: totalAbonado,
            saldo_restante: saldoRestante,
            atendido: seg?.atendido ?? false,
            fecha_cobro_especifica: v.fecha_cobro_especifica ?? null,
            periodo_inicio: periodoInicioStr,
            periodo_fin: periodoFinStr,
            abono_en_periodo: pagosEnPeriodo.has(v.id),
          } as CreditoCobranza
        })
        .filter((c) => c.saldo_restante > 0)
        .filter((c) => !c.abono_en_periodo)
    },
  })

  return { ...query, periodo, periodoInicioStr, periodoFinStr }
}

export function useAgendaDiaria(fecha: string) {
  const supabase = createClient()

  return useQuery<CreditoCobranza[]>({
    queryKey: ["cobranza_agenda", fecha],
    queryFn: async () => {
      // Fetch all active credits
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(`*, clientes(nombre, telefono, ciudad_id)`)
        .eq("tipo_venta", "credito")
        .eq("estado_credito", "activo")
        .order("created_at", { ascending: false })
      if (ventasError) throw ventasError

      const ventaIds = (ventas ?? []).map((v) => v.id)
      if (ventaIds.length === 0) return []

      // Payments
      const { data: pagos, error: pagosError } = await supabase
        .from("pagos")
        .select("venta_id, monto")
        .in("venta_id", ventaIds)
      if (pagosError) throw pagosError

      const pagosPorVenta: Record<string, number> = {}
      for (const p of pagos ?? []) {
        pagosPorVenta[p.venta_id] = (pagosPorVenta[p.venta_id] || 0) + p.monto
      }

      // City names
      const ciudadIds = Array.from(
        new Set((ventas ?? []).map((v) => v.clientes?.ciudad_id).filter(Boolean))
      )
      let ciudadMap: Record<string, string> = {}
      if (ciudadIds.length > 0) {
        const { data: ciudades } = await supabase
          .from("cat_ciudad")
          .select("id, nombre")
          .in("id", ciudadIds)
        ciudadMap = (ciudades ?? []).reduce(
          (acc, c) => ({ ...acc, [c.id]: c.nombre }),
          {} as Record<string, string>
        )
      }

      const fechaRef = parseISO(fecha)

      return (ventas ?? [])
        .map((v) => {
          const totalAbonado = pagosPorVenta[v.id] || 0
          const saldoRestante = v.total - totalAbonado
          const ciudadNombre = v.clientes?.ciudad_id
            ? ciudadMap[v.clientes.ciudad_id] ?? null
            : null

          // Check if credit has specific date matching today
          const tieneEspecifica = v.fecha_cobro_especifica === fecha

          // Check if today falls within this credit's current period
          const freq = v.periodicidad as Frecuencia | null
          let enPeriodo = false
          if (freq) {
            const periodo = calcularPeriodoActual(freq, fechaRef)
            enPeriodo = isWithinInterval(fechaRef, {
              start: periodo.inicio,
              end: periodo.fin,
            })
          }

          if (!tieneEspecifica && !enPeriodo) return null

          return {
            ...v,
            clientes: v.clientes
              ? {
                  nombre: v.clientes.nombre,
                  telefono: v.clientes.telefono,
                  ciudad: ciudadNombre,
                }
              : null,
            total_abonado: totalAbonado,
            saldo_restante: saldoRestante,
            atendido: false,
            fecha_cobro_especifica: v.fecha_cobro_especifica ?? null,
            periodo_inicio: fecha,
            periodo_fin: fecha,
            abono_en_periodo: false,
          } as CreditoCobranza
        })
        .filter((c): c is CreditoCobranza => c !== null && c.saldo_restante > 0)
    },
    enabled: !!fecha,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useMarcarAtendido() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      venta_id: string
      periodo_inicio: string
      periodo_fin: string
      frecuencia: string
      atendido: boolean
    }) => {
      const { data, error } = await supabase
        .from("cobranza_seguimiento")
        .upsert(
          {
            venta_id: input.venta_id,
            periodo_inicio: input.periodo_inicio,
            periodo_fin: input.periodo_fin,
            frecuencia: input.frecuencia,
            atendido: input.atendido,
            fecha_atendido: input.atendido ? new Date().toISOString() : null,
          },
          { onConflict: "venta_id,periodo_inicio" }
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobranza"] })
    },
    onError: () => toast.error("Error al actualizar seguimiento"),
  })
}

export function useAsignarFechaCobro() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      venta_id: string
      fecha_cobro_especifica: string | null
    }) => {
      const { error } = await supabase
        .from("ventas")
        .update({ fecha_cobro_especifica: input.fecha_cobro_especifica })
        .eq("id", input.venta_id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobranza"] })
      queryClient.invalidateQueries({ queryKey: ["cobranza_agenda"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_activos"] })
      toast.success("Fecha de cobro asignada")
    },
    onError: () => toast.error("Error al asignar fecha de cobro"),
  })
}
