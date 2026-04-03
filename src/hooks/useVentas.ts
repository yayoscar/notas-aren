"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Venta, VentaDetalle, Pago } from "@/lib/supabase/types"
import { toast } from "sonner"
import { localDateToISO } from "@/lib/utils"

export type VentaWithRelations = Venta & {
  vendedores: { nombre: string } | null
  clientes: { nombre: string; telefono: string } | null
}

export type VentaDetalleWithProducto = VentaDetalle & {
  productos: { nombre: string; sku: string; estado_producto: string; precio_venta_contado: number | null; precio_venta_credito: number | null; producto_origen_id: string | null } | null
}

export type PagoWithCuenta = Pago & {
  cat_cuenta_bancaria: { alias: string; clabe: string } | null
  vendedores: { nombre: string } | null
}

export type VentaFullDetail = Venta & {
  vendedores: { nombre: string } | null
  clientes: { nombre: string; telefono: string } | null
  ventas_detalle: VentaDetalleWithProducto[]
  pagos: PagoWithCuenta[]
  lineas_credito: {
    saldo_total: number
    saldo_pagado: number
    meses_credito: number
    periodicidad: string
    fecha_siguiente_pago: string | null
  } | null
}

interface VentaDetalleInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

interface PagoInput {
  monto: number
  tipo_pago: string
  cuenta_bancaria_id?: string | null
}

interface CrearVentaInput {
  vendedor_id: string
  cliente_id: string
  tipo_venta: string
  fecha: string
  detalles: VentaDetalleInput[]
  // Contado
  pago?: PagoInput
  // Crédito
  linea_credito_id?: string
  periodicidad?: string | null
  fecha_primer_pago?: string | null
  entrega_despues_pago?: boolean
  meses_credito?: number | null
  primer_abono?: PagoInput | null
  ajuste_meses_credito?: number
  ajuste_periodicidad?: string
  ajuste_fecha_siguiente_pago?: string
}

export function useVentas() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<VentaWithRelations[]>({
    queryKey: ["ventas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select(`*, vendedores(nombre), clientes(nombre, telefono)`)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as unknown as VentaWithRelations[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: CrearVentaInput) => {
      const { detalles, pago, primer_abono, linea_credito_id, ajuste_meses_credito, ajuste_periodicidad, ajuste_fecha_siguiente_pago, ...ventaData } =
        input

      // Calcular total
      const total = detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      // --- Línea de crédito logic ---
      let resolvedLineaCreditoId: string | null = null

      if (ventaData.tipo_venta === "credito") {
        if (linea_credito_id) {
          // Existing línea: accumulate saldo
          resolvedLineaCreditoId = linea_credito_id

          const { data: lineaActual, error: fetchErr } = await supabase
            .from("lineas_credito")
            .select("saldo_total")
            .eq("id", linea_credito_id)
            .single()
          if (fetchErr) throw fetchErr

          const { error: updateErr } = await supabase
            .from("lineas_credito")
            .update({
              saldo_total: (lineaActual.saldo_total ?? 0) + total,
              updated_at: new Date().toISOString(),
            })
            .eq("id", linea_credito_id)
          if (updateErr) throw updateErr
        } else {
          // New línea de crédito
          const { data: nuevaLinea, error: lineaErr } = await supabase
            .from("lineas_credito")
            .insert({
              cliente_id: ventaData.cliente_id,
              vendedor_id: ventaData.vendedor_id,
              saldo_total: total,
              meses_credito: ventaData.meses_credito ?? 2,
              periodicidad: ventaData.periodicidad ?? "quincenal",
              fecha_inicio: localDateToISO(ventaData.fecha_primer_pago ?? ventaData.fecha),
              fecha_siguiente_pago: ventaData.fecha_primer_pago ? localDateToISO(ventaData.fecha_primer_pago) : null,
              estado: "activa",
            })
            .select()
            .single()
          if (lineaErr) throw lineaErr

          resolvedLineaCreditoId = nuevaLinea.id as string
        }
      }

      // Generate folio: V-YYYYMMDD-XXXX (timestamp + random to avoid collisions)
      const now = new Date()
      const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase()
      const folio = `V-${datePart}-${randPart}`

      // Insertar venta
      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .insert({
          ...ventaData,
          folio,
          total,
          fecha: localDateToISO(ventaData.fecha),
          fecha_primer_pago: ventaData.fecha_primer_pago ? localDateToISO(ventaData.fecha_primer_pago) : null,
          estado_credito:
            ventaData.tipo_venta === "credito" ? "activo" : null,
          linea_credito_id: resolvedLineaCreditoId,
        })
        .select()
        .single()
      if (ventaError) throw ventaError

      // Insertar detalle
      const detailRows = detalles.map((d) => ({
        venta_id: venta.id as string,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
      }))

      const { error: detalleError } = await supabase
        .from("ventas_detalle")
        .insert(detailRows)
      if (detalleError) throw detalleError

      // Insertar pago de contado
      if (ventaData.tipo_venta === "contado" && pago) {
        const { error: pagoError } = await supabase.from("pagos").insert({
          venta_id: venta.id as string,
          monto: pago.monto,
          tipo_pago: pago.tipo_pago,
          cuenta_bancaria_id: pago.cuenta_bancaria_id ?? null,
          vendedor_id: ventaData.vendedor_id,
          cliente_id: ventaData.cliente_id,
        })
        if (pagoError) throw pagoError
      }

      // Insertar primer abono de crédito (opcional)
      if (
        ventaData.tipo_venta === "credito" &&
        primer_abono &&
        primer_abono.monto > 0
      ) {
        const { error: abonoError } = await supabase.from("pagos").insert({
          venta_id: venta.id as string,
          linea_credito_id: resolvedLineaCreditoId,
          monto: primer_abono.monto,
          tipo_pago: primer_abono.tipo_pago,
          cuenta_bancaria_id: primer_abono.cuenta_bancaria_id ?? null,
          vendedor_id: ventaData.vendedor_id,
          cliente_id: ventaData.cliente_id,
        })
        if (abonoError) throw abonoError

        // Update saldo_pagado on the línea
        if (resolvedLineaCreditoId) {
          const { data: lineaForAbono, error: fetchErr2 } = await supabase
            .from("lineas_credito")
            .select("saldo_pagado")
            .eq("id", resolvedLineaCreditoId)
            .single()
          if (fetchErr2) throw fetchErr2

          const { error: updateErr2 } = await supabase
            .from("lineas_credito")
            .update({
              saldo_pagado:
                (lineaForAbono.saldo_pagado ?? 0) + primer_abono.monto,
              updated_at: new Date().toISOString(),
            })
            .eq("id", resolvedLineaCreditoId)
          if (updateErr2) throw updateErr2
        }
      }

      // Apply plan adjustment if provided
      if (ajuste_meses_credito && ajuste_periodicidad && ajuste_fecha_siguiente_pago && resolvedLineaCreditoId) {
        await supabase.from("lineas_credito").update({
          meses_credito: ajuste_meses_credito,
          periodicidad: ajuste_periodicidad,
          fecha_siguiente_pago: localDateToISO(ajuste_fecha_siguiente_pago),
          updated_at: new Date().toISOString(),
        }).eq("id", resolvedLineaCreditoId)
      }

      return venta
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito_cliente"] })
      toast.success("Venta registrada exitosamente")
    },
    onError: () => toast.error("Error al registrar venta"),
  })

  const updateVenta = useMutation({
    mutationFn: async (input: {
      venta_id: string
      detalles: VentaDetalleInput[]
      motivo_edicion: string
      vendedor_id: string
    }) => {
      // Snapshot current state
      const { data: ventaActual, error: fetchErr } = await supabase
        .from("ventas")
        .select("*, ventas_detalle(*)")
        .eq("id", input.venta_id)
        .single()
      if (fetchErr) throw fetchErr

      const oldDetalles = (
        ventaActual as { ventas_detalle: Array<{ producto_id: string; cantidad: number }> }
      ).ventas_detalle

      // Calculate stock diffs: revert old, apply new
      // Build maps: producto_id -> total quantity
      const oldQtyMap: Record<string, number> = {}
      for (const d of oldDetalles) {
        oldQtyMap[d.producto_id] = (oldQtyMap[d.producto_id] || 0) + d.cantidad
      }
      const newQtyMap: Record<string, number> = {}
      for (const d of input.detalles) {
        newQtyMap[d.producto_id] = (newQtyMap[d.producto_id] || 0) + d.cantidad
      }

      // All affected product IDs
      const allProductIds = Array.from(new Set([
        ...Object.keys(oldQtyMap),
        ...Object.keys(newQtyMap),
      ]))

      for (const prodId of allProductIds) {
        const oldQty = oldQtyMap[prodId] || 0
        const newQty = newQtyMap[prodId] || 0
        const diff = newQty - oldQty // positive = need more stock out, negative = return stock

        if (diff !== 0) {
          const { data: prod } = await supabase
            .from("productos")
            .select("stock_actual")
            .eq("id", prodId)
            .single()
          const stockAntes = prod?.stock_actual ?? 0

          await supabase
            .from("productos")
            .update({
              stock_actual: stockAntes - diff,
              updated_at: new Date().toISOString(),
            })
            .eq("id", prodId)

          await supabase.from("stock_movimientos").insert({
            producto_id: prodId,
            tipo: diff > 0 ? "SALIDA_VENTA" : "AJUSTE_POSITIVO",
            cantidad: Math.abs(diff),
            stock_antes: stockAntes,
            stock_despues: stockAntes - diff,
            referencia_id: input.venta_id,
            referencia_tipo: "edicion_venta",
          })
        }
      }

      // Delete old detalles and insert new ones
      await supabase
        .from("ventas_detalle")
        .delete()
        .eq("venta_id", input.venta_id)

      const newTotal = input.detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      await supabase.from("ventas_detalle").insert(
        input.detalles.map((d) => ({
          venta_id: input.venta_id,
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        }))
      )

      // Update venta total
      await supabase
        .from("ventas")
        .update({ total: newTotal, updated_at: new Date().toISOString() })
        .eq("id", input.venta_id)

      // Record history
      await supabase.from("ventas_historial").insert({
        venta_id: input.venta_id,
        tipo: "edicion",
        usuario_id: input.vendedor_id,
        datos_anteriores: ventaActual as unknown as Record<string, unknown>,
        datos_nuevos: {
          detalles: input.detalles,
          total: newTotal,
        },
        motivo: input.motivo_edicion,
      })

      return { id: input.venta_id, total: newTotal }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({
        queryKey: ["ventas", variables.venta_id],
      })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Venta actualizada exitosamente")
    },
    onError: () => toast.error("Error al actualizar venta"),
  })

  return { query, create, updateVenta }
}

export function useVenta(id: string) {
  const supabase = createClient()

  return useQuery<VentaFullDetail>({
    queryKey: ["ventas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select(
          `*, vendedores(nombre), clientes(nombre, telefono), ventas_detalle(*, productos(nombre, sku, estado_producto, precio_venta_contado, precio_venta_credito, producto_origen_id)), pagos(*, cat_cuenta_bancaria(alias, clabe), vendedores(nombre)), lineas_credito(saldo_total, saldo_pagado, meses_credito, periodicidad, fecha_siguiente_pago)`
        )
        .eq("id", id)
        .single()
      if (error) throw error
      return data as unknown as VentaFullDetail
    },
    enabled: !!id,
  })
}

export type VentaHistorialCliente = Venta & {
  vendedores: { nombre: string } | null
  ventas_detalle: (VentaDetalle & { productos: { nombre: string } | null })[]
  total_abonado: number
  saldo_restante: number
}

export function useVentasCliente(clienteId: string) {
  const supabase = createClient()

  return useQuery<VentaHistorialCliente[]>({
    queryKey: ["ventas", "cliente", clienteId],
    queryFn: async () => {
      const { data: ventas, error: ventasError } = await supabase
        .from("ventas")
        .select(
          `*, vendedores(nombre), ventas_detalle(*, productos(nombre))`
        )
        .eq("cliente_id", clienteId)
        .order("fecha", { ascending: false })
      if (ventasError) throw ventasError

      // Obtener pagos para ventas de crédito
      const creditoIds = (ventas ?? [])
        .filter((v) => v.tipo_venta === "credito")
        .map((v) => v.id)

      let pagosPorVenta: Record<string, number> = {}

      if (creditoIds.length > 0) {
        const { data: pagos, error: pagosError } = await supabase
          .from("pagos")
          .select("venta_id, monto")
          .in("venta_id", creditoIds)
        if (pagosError) throw pagosError

        pagosPorVenta = (pagos ?? []).reduce(
          (acc, p) => {
            acc[p.venta_id] = (acc[p.venta_id] || 0) + p.monto
            return acc
          },
          {} as Record<string, number>
        )
      }

      return (ventas ?? []).map((v) => {
        const isCredito = v.tipo_venta === "credito"
        const totalAbonado = isCredito
          ? pagosPorVenta[v.id] || 0
          : v.total
        return {
          ...v,
          total_abonado: totalAbonado,
          saldo_restante: v.total - totalAbonado,
        } as VentaHistorialCliente
      })
    },
    enabled: !!clienteId,
  })
}
