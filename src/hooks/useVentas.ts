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

export type VentaDetalleDescuentoJoined = {
  porcentaje_aplicado: number
  precio_original: number
  precio_final: number
  cat_tipo_descuento: { nombre: string } | null
}

export type VentaDetalleWithProducto = VentaDetalle & {
  productos: { nombre: string; sku: string; estado_producto: string; precio_venta_contado: number | null; precio_venta_credito: number | null; producto_origen_id: string | null } | null
  ventas_detalle_descuento: VentaDetalleDescuentoJoined | VentaDetalleDescuentoJoined[] | null
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

interface DescuentoDetalleInput {
  tipo_descuento_id: string
  porcentaje: number
  precio_original: number
}

interface VentaDetalleInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
  descuento?: DescuentoDetalleInput | null
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

      const { data: insertedDetalles, error: detalleError } = await supabase
        .from("ventas_detalle")
        .insert(detailRows)
        .select("id")
      if (detalleError) throw detalleError

      // Insertar descuentos por ítem (0..1 por detalle)
      const descuentoRows = detalles
        .map((d, i) =>
          d.descuento
            ? {
                venta_detalle_id: (insertedDetalles![i] as { id: string }).id,
                tipo_descuento_id: d.descuento.tipo_descuento_id,
                porcentaje_aplicado: d.descuento.porcentaje,
                precio_original: d.descuento.precio_original,
                precio_final: d.precio_unitario,
              }
            : null
        )
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (descuentoRows.length > 0) {
        const { error: descError } = await supabase
          .from("ventas_detalle_descuento")
          .insert(descuentoRows)
        if (descError) throw descError
      }

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
      queryClient.invalidateQueries({ queryKey: ["ventas_detalle_descuento"] })
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

      // El stock lo ajustan los triggers de la base de datos de forma simétrica:
      // al borrar los detalles viejos, trg_stock_venta_delete repone su cantidad;
      // al insertar los nuevos, trg_stock_venta la vuelve a descontar. No hay que
      // tocar stock_actual manualmente aquí (hacerlo causaba doble descuento).

      // Delete old detalles (CASCADE clears ventas_detalle_descuento) and insert new ones
      await supabase
        .from("ventas_detalle")
        .delete()
        .eq("venta_id", input.venta_id)

      const newTotal = input.detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      const { data: newDetalles } = await supabase
        .from("ventas_detalle")
        .insert(
          input.detalles.map((d) => ({
            venta_id: input.venta_id,
            producto_id: d.producto_id,
            cantidad: d.cantidad,
            precio_unitario: d.precio_unitario,
          }))
        )
        .select("id")

      // Reinsertar descuentos
      const descuentoRows = input.detalles
        .map((d, i) =>
          d.descuento && newDetalles
            ? {
                venta_detalle_id: (newDetalles[i] as { id: string }).id,
                tipo_descuento_id: d.descuento.tipo_descuento_id,
                porcentaje_aplicado: d.descuento.porcentaje,
                precio_original: d.descuento.precio_original,
                precio_final: d.precio_unitario,
              }
            : null
        )
        .filter((r): r is NonNullable<typeof r> => r !== null)

      if (descuentoRows.length > 0) {
        await supabase.from("ventas_detalle_descuento").insert(descuentoRows)
      }

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
          `*, vendedores(nombre), clientes(nombre, telefono), ventas_detalle(*, productos(nombre, sku, estado_producto, precio_venta_contado, precio_venta_credito, producto_origen_id), ventas_detalle_descuento(porcentaje_aplicado, precio_original, precio_final, cat_tipo_descuento(nombre))), pagos(*, cat_cuenta_bancaria(alias, clabe), vendedores(nombre)), lineas_credito(saldo_total, saldo_pagado, meses_credito, periodicidad, fecha_siguiente_pago)`
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
  /**
   * Si el crédito de esta venta está saldado. Viene de la vista, no de la
   * columna `estado_credito`: la columna se sincroniza sola, pero la vista es
   * la que manda y no depende de que el trigger haya corrido.
   */
  credito_saldado: boolean
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

      // El saldo de una venta a crédito NO es `total - SUM(pagos de esa venta)`:
      // desde que el crédito vive en lineas_credito, los abonos se registran
      // contra la línea del cliente y `pagos.venta_id` viene nulo en todo lo
      // cobrado desde Cobranza. Restar sólo los pagos atados a la venta dejaba
      // el historial mostrando "Crédito activo" sobre créditos ya liquidados.
      //
      // El reparto vive en v_venta_credito_saldo, que es también lo que usa el
      // trigger que sincroniza estado_credito. Calcularlo aquí otra vez sería
      // repetir el error.
      const { data: saldos, error: saldosError } = await supabase
        .from("v_venta_credito_saldo")
        .select("venta_id, imputado, saldada, saldo_pendiente")
        .eq("cliente_id", clienteId)
      if (saldosError) throw saldosError

      const saldoPorVenta = new Map(
        (saldos ?? []).map((s) => [s.venta_id as string, s])
      )

      return (ventas ?? []).map((v) => {
        if (v.tipo_venta !== "credito") {
          return {
            ...v,
            total_abonado: v.total,
            saldo_restante: 0,
            credito_saldado: true,
          } as VentaHistorialCliente
        }

        // Una venta cancelada queda fuera de la vista: no consume abonos.
        const s = saldoPorVenta.get(v.id as string)

        return {
          ...v,
          total_abonado: Number(s?.imputado ?? 0),
          saldo_restante: Number(s?.saldo_pendiente ?? 0),
          credito_saldado: s ? Boolean(s.saldada) : true,
        } as VentaHistorialCliente
      })
    },
    enabled: !!clienteId,
  })
}

