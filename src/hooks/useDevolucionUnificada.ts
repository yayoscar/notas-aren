"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

import { toast } from "sonner"

interface ProductoDevueltoInput {
  producto_id: string
  cantidad: number
  estado_devuelto: "nuevo" | "segunda" | "parcial"
  precio_original: number
  precio_depreciado?: number
}

interface DevolucionUnificadaInput {
  venta_id: string
  tipo: "devolucion" | "anulacion"
  vendedor_id: string
  cliente_id: string
  fecha: string
  motivo: string
  productos_devueltos: ProductoDevueltoInput[]
  destino_monto: "efectivo" | "abono_credito" | "ajuste_plan" | null
  tipo_venta_original: "contado" | "credito"
  ajuste_plan?: {
    meses_credito: number
    periodicidad: string
    fecha_siguiente_pago: string
  }
}

export function useDevolucionUnificada() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DevolucionUnificadaInput) => {
      const {
        productos_devueltos,
        tipo_venta_original,
        destino_monto,
        motivo,
        ajuste_plan,
      } = input

      // 1. Fetch venta completa con detalle
      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .select("*, ventas_detalle(*), pagos(*)")
        .eq("id", input.venta_id)
        .single()
      if (ventaError) throw ventaError

      const ventaDetalles = (venta as unknown as { ventas_detalle: Array<{ producto_id: string; cantidad: number; precio_unitario: number }> }).ventas_detalle

      // 2. Auto-detectar anulación: si se devuelven TODOS los productos enteros con cantidades completas
      let tipoFinal = input.tipo
      const esDevolucionTotal = ventaDetalles.every((vd) => {
        const devuelto = productos_devueltos.find(
          (pd) => pd.producto_id === vd.producto_id
        )
        return (
          devuelto &&
          devuelto.estado_devuelto === "nuevo" &&
          devuelto.cantidad >= vd.cantidad
        )
      })
      const todosDevueltos = productos_devueltos.length >= ventaDetalles.length
      if (esDevolucionTotal && todosDevueltos) {
        tipoFinal = "anulacion"
      }

      // 3. Calcular montos
      const montoDevuelto = productos_devueltos.reduce((sum, p) => {
        if (p.estado_devuelto === "nuevo") {
          return sum + p.precio_original * p.cantidad
        }
        // segunda or parcial: use precio_depreciado
        const precio = p.precio_depreciado ?? p.precio_original
        return sum + precio * p.cantidad
      }, 0)

      const montoNuevo = 0
      const diferencia = montoDevuelto

      // 4. Insertar registro en devoluciones
      const { data: devolucion, error: devError } = await supabase
        .from("devoluciones")
        .insert({
          venta_id: input.venta_id,
          tipo: tipoFinal,
          vendedor_id: input.vendedor_id,
          cliente_id: input.cliente_id,
          fecha: input.fecha,
          monto_original: montoDevuelto,
          monto_nuevo: null,
          diferencia: montoDevuelto,
          notas: motivo,
        })
        .select()
        .single()
      if (devError) throw devError

      // 5. Insertar detalle de productos devueltos y revertir inventario
      for (const p of productos_devueltos) {
        const precioUsado =
          (p.estado_devuelto === "segunda" || p.estado_devuelto === "parcial") && p.precio_depreciado
            ? p.precio_depreciado
            : p.precio_original

        await supabase.from("devoluciones_detalle").insert({
          devolucion_id: devolucion.id,
          tipo: "devuelto",
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          precio_unitario: precioUsado,
          estado_producto_devuelto: p.estado_devuelto,
        })

        // Revertir inventario
        if (p.estado_devuelto === "nuevo") {
          // Producto entero: vuelve al stock original
          const { data: prod } = await supabase
            .from("productos")
            .select("stock_actual")
            .eq("id", p.producto_id)
            .single()
          const stockAntes = prod?.stock_actual ?? 0

          await supabase
            .from("productos")
            .update({
              stock_actual: stockAntes + p.cantidad,
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.producto_id)

          await supabase.from("stock_movimientos").insert({
            producto_id: p.producto_id,
            tipo: "ENTRADA_CAMBIO",
            cantidad: p.cantidad,
            stock_antes: stockAntes,
            stock_despues: stockAntes + p.cantidad,
            referencia_id: devolucion.id,
            referencia_tipo: tipoFinal,
          })
        } else {
          // segunda or parcial: buscar derivado existente o crear uno nuevo
          const { data: prod } = await supabase
            .from("productos")
            .select("*")
            .eq("id", p.producto_id)
            .single()
          if (!prod) continue

          const origenId = prod.producto_origen_id || prod.id
          const estadoDerivado = p.estado_devuelto // "segunda" | "parcial"

          // Buscar si ya existe un derivado del mismo estado y producto origen
          const { data: derivadoExistente } = await supabase
            .from("productos")
            .select("id, stock_actual")
            .eq("producto_origen_id", origenId)
            .eq("estado_producto", estadoDerivado)
            .maybeSingle()

          if (derivadoExistente) {
            // Incrementar stock del derivado existente
            await supabase
              .from("productos")
              .update({
                stock_actual: derivadoExistente.stock_actual + p.cantidad,
                updated_at: new Date().toISOString(),
              })
              .eq("id", derivadoExistente.id)
          } else {
            // Crear nuevo producto derivado con SKU único
            const skuSuffix = estadoDerivado === "segunda" ? "SEG" : "PAR"
            const skuRand = Math.random().toString(36).substring(2, 6).toUpperCase()
            const skuDerivado = `${prod.sku}-${skuSuffix}-${skuRand}`
            await supabase.from("productos").insert({
              nombre: prod.nombre,
              marca: prod.marca,
              sku: skuDerivado,
              genero_id: prod.genero_id,
              tamano_id: prod.tamano_id,
              presentacion_id: prod.presentacion_id,
              concentracion_id: prod.concentracion_id,
              tipo_perfume_id: prod.tipo_perfume_id,
              proveedor_id: prod.proveedor_id,
              precio_compra: prod.precio_compra,
              precio_venta_contado:
                p.precio_depreciado ?? prod.precio_venta_contado,
              precio_venta_credito:
                p.precio_depreciado ?? prod.precio_venta_credito,
              stock_actual: p.cantidad,
              stock_minimo: 0,
              producto_origen_id: origenId,
              estado_producto: estadoDerivado,
              activo: true,
            })
          }
        }
      }

      // 6. Si es anulación, marcar venta como cancelada
      if (tipoFinal === "anulacion") {
        await supabase
          .from("ventas")
          .update({
            estado_venta: "cancelada",
            motivo_cancelacion: motivo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.venta_id)

        if (tipo_venta_original === "credito") {
          await supabase
            .from("ventas")
            .update({ estado_credito: "liquidado" })
            .eq("id", input.venta_id)

          // Also deduct from linea de credito
          const { data: ventaAnulada } = await supabase
            .from("ventas")
            .select("total, linea_credito_id")
            .eq("id", input.venta_id)
            .single()

          if (ventaAnulada?.linea_credito_id) {
            const { data: linea } = await supabase
              .from("lineas_credito")
              .select("*")
              .eq("id", ventaAnulada.linea_credito_id)
              .single()

            if (linea) {
              const nuevoSaldoTotal = linea.saldo_total - montoDevuelto
              const newSaldoPendiente = nuevoSaldoTotal - linea.saldo_pagado
              const lineaUpdate: Record<string, unknown> = {
                saldo_total: Math.max(nuevoSaldoTotal, linea.saldo_pagado),
                updated_at: new Date().toISOString(),
              }
              if (newSaldoPendiente <= 0) {
                lineaUpdate.estado = "liquidada"
              }
              await supabase
                .from("lineas_credito")
                .update(lineaUpdate)
                .eq("id", linea.id)
            }
          }
        }
      }

      // 7. Resolución del monto
      let montoResolver = montoDevuelto
      let montoDevueltoEfectivo = 0
      let montoAbonadoCredito = 0
      const creditoAbonadoFolio = ""

      if (montoResolver > 0) {
        // Si la venta original es de crédito: deducir de la línea de crédito
        if (tipo_venta_original === "credito" && tipoFinal !== "anulacion") {
          // Fetch linea_credito_id from the venta
          const { data: ventaActual } = await supabase
            .from("ventas")
            .select("total, linea_credito_id")
            .eq("id", input.venta_id)
            .single()

          if (ventaActual) {
            // Update the venta total
            const nuevoTotal = ventaActual.total - montoResolver
            await supabase
              .from("ventas")
              .update({ total: nuevoTotal, updated_at: new Date().toISOString() })
              .eq("id", input.venta_id)

            // Deduct from linea de credito if it exists
            if (ventaActual.linea_credito_id) {
              const { data: linea } = await supabase
                .from("lineas_credito")
                .select("*")
                .eq("id", ventaActual.linea_credito_id)
                .single()

              if (linea) {
                const nuevoSaldoTotal = linea.saldo_total - montoResolver
                const newSaldoPendiente = nuevoSaldoTotal - linea.saldo_pagado

                const lineaUpdate: Record<string, unknown> = {
                  saldo_total: nuevoSaldoTotal,
                  updated_at: new Date().toISOString(),
                }

                if (newSaldoPendiente <= 0) {
                  lineaUpdate.estado = "liquidada"
                }

                // If destino is ajuste_plan, also update plan values on the linea
                if (destino_monto === "ajuste_plan" && ajuste_plan) {
                  lineaUpdate.meses_credito = ajuste_plan.meses_credito
                  lineaUpdate.periodicidad = ajuste_plan.periodicidad
                  lineaUpdate.fecha_siguiente_pago = ajuste_plan.fecha_siguiente_pago
                }

                await supabase
                  .from("lineas_credito")
                  .update(lineaUpdate)
                  .eq("id", linea.id)

                montoAbonadoCredito = montoResolver

                if (newSaldoPendiente < 0) {
                  // Overpayment: saldo_pagado exceeds new saldo_total
                  // Clamp saldo_total to saldo_pagado so the linea is balanced
                  montoDevueltoEfectivo = Math.abs(newSaldoPendiente)
                  await supabase
                    .from("lineas_credito")
                    .update({ saldo_total: linea.saldo_pagado })
                    .eq("id", linea.id)
                  montoAbonadoCredito = montoResolver - montoDevueltoEfectivo
                }

                montoResolver = montoDevueltoEfectivo // Only the overpayment remains
              }
            } else {
              // No linea — fallback: check if abonos exceed new total
              const pagos = (venta as unknown as { pagos: Array<{ monto: number }> }).pagos
              const totalPagado = pagos.reduce((sum, pg) => sum + pg.monto, 0)

              if (totalPagado > nuevoTotal) {
                montoResolver = totalPagado - nuevoTotal
                if (totalPagado >= nuevoTotal) {
                  await supabase
                    .from("ventas")
                    .update({ estado_credito: "liquidado", updated_at: new Date().toISOString() })
                    .eq("id", input.venta_id)
                }
              } else {
                montoResolver = 0
              }
            }
          }
        }

        // Lo que quede se devuelve en efectivo
        if (montoResolver > 0) {
          montoDevueltoEfectivo = montoResolver
        }
      }

      // 8. Registrar en historial
      await supabase.from("ventas_historial").insert({
        venta_id: input.venta_id,
        tipo: tipoFinal,
        usuario_id: input.vendedor_id,
        datos_anteriores: venta as unknown as Record<string, unknown>,
        datos_nuevos: {
          productos_devueltos,
          monto_devuelto: montoDevuelto,
          monto_nuevo: montoNuevo,
          diferencia,
          destino_monto,
          monto_abonado_credito: montoAbonadoCredito,
          monto_devuelto_efectivo: montoDevueltoEfectivo,
          credito_abonado_folio: creditoAbonadoFolio,
        },
        motivo,
      })

      return {
        devolucion,
        tipo: tipoFinal,
        montoDevuelto,
        montoNuevo,
        diferencia,
        montoAbonadoCredito,
        montoDevueltoEfectivo,
        creditoAbonadoFolio,
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      queryClient.invalidateQueries({ queryKey: ["devoluciones"] })
      queryClient.invalidateQueries({ queryKey: ["creditos_activos"] })
      queryClient.invalidateQueries({ queryKey: ["saldos_favor"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["cobranza_v2"] })
      queryClient.invalidateQueries({ queryKey: ["linea_credito"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_cliente"] })
      queryClient.invalidateQueries({ queryKey: ["pagos_linea"] })
      const msg =
        data.tipo === "anulacion"
          ? "Venta anulada exitosamente"
          : "Devolucion registrada exitosamente"
      toast.success(msg)
    },
    onError: () => toast.error("Error al procesar la operacion"),
  })
}
