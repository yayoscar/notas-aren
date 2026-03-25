"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useVentasPorPeriodo(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "ventas_periodo", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("fecha, total")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
        .order("fecha")
      if (error) throw error

      // Agrupar por fecha
      const agrupado = (data ?? []).reduce(
        (acc, v) => {
          acc[v.fecha] = (acc[v.fecha] || 0) + v.total
          return acc
        },
        {} as Record<string, number>
      )

      return Object.entries(agrupado).map(([fecha, total]) => ({
        fecha,
        total,
      }))
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function useVentasPorVendedor(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "ventas_vendedor", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("total, vendedores(nombre)")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? []).reduce(
        (acc, v) => {
          const nombre =
            (v.vendedores as unknown as { nombre: string })?.nombre ??
            "Sin asignar"
          acc[nombre] = (acc[nombre] || 0) + v.total
          return acc
        },
        {} as Record<string, number>
      )

      return Object.entries(agrupado).map(([vendedor, total]) => ({
        vendedor,
        total,
      }))
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function useVentasPorTipo(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "ventas_tipo", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("tipo_venta, total")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? []).reduce(
        (acc, v) => {
          if (!acc[v.tipo_venta]) acc[v.tipo_venta] = { count: 0, total: 0 }
          acc[v.tipo_venta].count++
          acc[v.tipo_venta].total += v.total
          return acc
        },
        {} as Record<string, { count: number; total: number }>
      )

      return Object.entries(agrupado).map(([tipo, data]) => ({
        tipo: tipo === "contado" ? "Contado" : "Crédito",
        ...data,
      }))
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function useProductosMasVendidos(
  fechaInicio: string,
  fechaFin: string
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "productos_top", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas_detalle")
        .select("cantidad, productos(nombre), ventas!inner(fecha)")
        .gte("ventas.fecha", fechaInicio)
        .lte("ventas.fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? []).reduce(
        (acc, d) => {
          const nombre =
            (d.productos as unknown as { nombre: string })?.nombre ??
            "Desconocido"
          acc[nombre] = (acc[nombre] || 0) + d.cantidad
          return acc
        },
        {} as Record<string, number>
      )

      return Object.entries(agrupado)
        .map(([producto, cantidad]) => ({ producto, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 10)
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function useCreditosResumen() {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "creditos_resumen"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("estado_credito")
        .eq("tipo_venta", "credito")
      if (error) throw error

      const activos = (data ?? []).filter(
        (v) => v.estado_credito === "activo"
      ).length
      const liquidados = (data ?? []).filter(
        (v) => v.estado_credito === "liquidado"
      ).length

      return [
        { estado: "Activos", count: activos },
        { estado: "Liquidados", count: liquidados },
      ]
    },
  })
}

export function useIngresosVsEgresos(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "ingresos_egresos", fechaInicio, fechaFin],
    queryFn: async () => {
      const [pagosRes, gastosRes] = await Promise.all([
        supabase
          .from("pagos")
          .select("fecha, monto")
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin),
        supabase
          .from("gastos")
          .select("fecha, monto")
          .gte("fecha", fechaInicio)
          .lte("fecha", fechaFin),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (gastosRes.error) throw gastosRes.error

      const totalIngresos = (pagosRes.data ?? []).reduce(
        (sum, p) => sum + p.monto,
        0
      )
      const totalEgresos = (gastosRes.data ?? []).reduce(
        (sum, g) => sum + g.monto,
        0
      )

      return { ingresos: totalIngresos, egresos: totalEgresos }
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

const TIPO_PAGO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  retiro_sin_tarjeta: "Retiro s/tarjeta",
}

export function usePagosPorMetodo(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "pagos_metodo", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("tipo_pago, monto")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? []).reduce(
        (acc, p) => {
          const tipo = p.tipo_pago
          acc[tipo] = (acc[tipo] || 0) + p.monto
          return acc
        },
        {} as Record<string, number>
      )

      return Object.entries(agrupado).map(([tipo, total]) => ({
        tipo: TIPO_PAGO_LABELS[tipo] ?? tipo,
        total,
      }))
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function usePagosPorCuenta(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "pagos_cuenta", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("monto, tipo_pago, cat_cuenta_bancaria(alias)")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? [])
        .filter((p) => p.tipo_pago === "transferencia")
        .reduce(
          (acc, p) => {
            const cuenta =
              (p.cat_cuenta_bancaria as unknown as { alias: string })?.alias ??
              "Sin cuenta"
            acc[cuenta] = (acc[cuenta] || 0) + p.monto
            return acc
          },
          {} as Record<string, number>
        )

      return Object.entries(agrupado)
        .map(([cuenta, total]) => ({ cuenta, total }))
        .sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}

export function usePagosPorVendedorYMetodo(fechaInicio: string, fechaFin: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["reportes", "pagos_vendedor_metodo", fechaInicio, fechaFin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagos")
        .select("monto, tipo_pago, vendedores(nombre)")
        .gte("fecha", fechaInicio)
        .lte("fecha", fechaFin)
      if (error) throw error

      const agrupado = (data ?? []).reduce(
        (acc, p) => {
          const vendedor =
            (p.vendedores as unknown as { nombre: string })?.nombre ??
            "Sin asignar"
          if (!acc[vendedor])
            acc[vendedor] = { efectivo: 0, transferencia: 0, retiro_sin_tarjeta: 0, total: 0 }
          const tipo = p.tipo_pago as "efectivo" | "transferencia" | "retiro_sin_tarjeta"
          if (tipo in acc[vendedor]) acc[vendedor][tipo] += p.monto
          acc[vendedor].total += p.monto
          return acc
        },
        {} as Record<string, { efectivo: number; transferencia: number; retiro_sin_tarjeta: number; total: number }>
      )

      return Object.entries(agrupado)
        .map(([vendedor, datos]) => ({ vendedor, ...datos }))
        .sort((a, b) => b.total - a.total)
    },
    enabled: !!fechaInicio && !!fechaFin,
  })
}
