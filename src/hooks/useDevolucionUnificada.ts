"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { recalcularCuotasCredito } from "@/lib/calculos/credito"
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
  // Nuevos campos para devoluciones de credito
  tiene_credito_activo_previo?: boolean
  opcion_diferencia?: "contado" | "ajuste_credito"
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
        tiene_credito_activo_previo,
        opcion_diferencia,
      } = input

      // 1. Fetch venta completa con detalle
      const { data: venta, error: ventaError } = await supabase
        .from("ventas")
        .select("*, ventas_detalle(*), pagos(*)")
        .eq("id", input.venta_id)
        .single()
      if (ventaError) throw ventaError

      const ventaDetalles = (venta as unknown as { ventas_detalle: Array<{ producto_id: string; cantidad: number; precio_unitario: number }> }).ventas_detalle

      // 2. Auto-detectar anulacion
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
        const precio = p.precio_depreciado ?? p.precio_original
        return sum + precio * p.cantidad
      }, 0)

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
          const estadoDerivado = p.estado_devuelto

          const { data: derivadoExistente } = await supabase
            .from("productos")
            .select("id, stock_actual")
            .eq("producto_origen_id", origenId)
            .eq("estado_producto", estadoDerivado)
            .maybeSingle()

          if (derivadoExistente) {
            await supabase
              .from("productos")
              .update({
                stock_actual: derivadoExistente.stock_actual + p.cantidad,
                updated_at: new Date().toISOString(),
              })
              .eq("id", derivadoExistente.id)
          } else {
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

      // 6. Resolucion del monto segun tipo de venta
      let montoDevueltoEfectivo = 0
      let montoAbonadoCredito = 0

      if (tipo_venta_original === "credito") {
        // ============================================
        // LOGICA DE CREDITO (8 reglas del PRD)
        // ============================================
        const { data: ventaActual } = await supabase
          .from("ventas")
          .select("total, linea_credito_id")
          .eq("id", input.venta_id)
          .single()

        const pagos = (venta as unknown as { pagos: Array<{ monto: number }> }).pagos
        const totalAbonado = pagos.reduce((sum, pg) => sum + pg.monto, 0)

        if (ventaActual?.linea_credito_id) {
          const { data: linea } = await supabase
            .from("lineas_credito")
            .select("*")
            .eq("id", ventaActual.linea_credito_id)
            .single()

          if (linea) {
            if (tipoFinal === "anulacion") {
              // === DEVOLUCION TOTAL ===
              await supabase
                .from("ventas")
                .update({
                  estado_venta: "cancelada",
                  estado_credito: "liquidado",
                  motivo_cancelacion: motivo,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", input.venta_id)

              if (tiene_credito_activo_previo) {
                // GRUPO 2 (2.1, 2.2): Abonar al credito activo
                const montoAbonar = montoDevuelto // precio segun estado de articulos
                const nuevoSaldoTotal = linea.saldo_total - montoAbonar
                const nuevoSaldoPendiente = nuevoSaldoTotal - linea.saldo_pagado

                const lineaUpdate: Record<string, unknown> = {
                  saldo_total: Math.max(nuevoSaldoTotal, linea.saldo_pagado),
                  updated_at: new Date().toISOString(),
                }
                if (nuevoSaldoPendiente <= 0) {
                  lineaUpdate.estado = "liquidada"
                }
                await supabase
                  .from("lineas_credito")
                  .update(lineaUpdate)
                  .eq("id", linea.id)

                montoAbonadoCredito = montoAbonar

                // Reembolsar abonos previos de esta venta en efectivo
                if (totalAbonado > 0) {
                  montoDevueltoEfectivo = totalAbonado
                }
              } else {
                // GRUPO 1 (1.1, 1.2): Cancelar linea propia

                // Calcular diferencia por deterioro
                const montoVentaOriginal = ventaActual.total
                const diferenciaDet = montoVentaOriginal - montoDevuelto

                if (diferenciaDet > 0 && opcion_diferencia === "ajuste_credito") {
                  // Mantener credito por la diferencia
                  const lineaUpdate: Record<string, unknown> = {
                    saldo_total: diferenciaDet + linea.saldo_pagado,
                    updated_at: new Date().toISOString(),
                  }
                  if (diferenciaDet <= 0) lineaUpdate.estado = "liquidada"
                  await supabase.from("lineas_credito").update(lineaUpdate).eq("id", linea.id)
                } else {
                  // Cancelar linea completamente
                  await supabase
                    .from("lineas_credito")
                    .update({
                      saldo_total: linea.saldo_pagado,
                      estado: "liquidada",
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", linea.id)
                }

                // Reembolsar abonos en efectivo
                if (totalAbonado > 0) {
                  if (diferenciaDet > 0 && opcion_diferencia === "contado") {
                    // Cliente debe pagar diferencia: restar del reembolso
                    montoDevueltoEfectivo = Math.max(0, totalAbonado - diferenciaDet)
                  } else {
                    montoDevueltoEfectivo = totalAbonado
                  }
                }

                montoAbonadoCredito = montoDevuelto
              }
            } else {
              // === DEVOLUCION PARCIAL ===
              // Actualizar total de la venta
              const nuevoTotal = ventaActual.total - montoDevuelto
              await supabase
                .from("ventas")
                .update({ total: nuevoTotal, updated_at: new Date().toISOString() })
                .eq("id", input.venta_id)

              // Recalcular cuotas (mismos plazos)
              const { nuevoSaldo } = recalcularCuotasCredito({
                saldoTotal: linea.saldo_total,
                saldoPagado: linea.saldo_pagado,
                montoDevolucion: montoDevuelto,
                mesesCredito: linea.meses_credito,
                periodicidad: linea.periodicidad as "semanal" | "quincenal" | "mensual",
              })

              const nuevoSaldoTotal = linea.saldo_total - montoDevuelto
              const lineaUpdate: Record<string, unknown> = {
                saldo_total: Math.max(nuevoSaldoTotal, linea.saldo_pagado),
                updated_at: new Date().toISOString(),
              }
              if (nuevoSaldo <= 0) {
                lineaUpdate.estado = "liquidada"
              }
              await supabase
                .from("lineas_credito")
                .update(lineaUpdate)
                .eq("id", linea.id)

              montoAbonadoCredito = montoDevuelto
            }
          }
        } else {
          // Venta de credito sin linea_credito (fallback)
          if (tipoFinal === "anulacion") {
            await supabase
              .from("ventas")
              .update({
                estado_venta: "cancelada",
                estado_credito: "liquidado",
                motivo_cancelacion: motivo,
                updated_at: new Date().toISOString(),
              })
              .eq("id", input.venta_id)
            if (totalAbonado > 0) {
              montoDevueltoEfectivo = totalAbonado
            }
          } else {
            const nuevoTotal = ventaActual!.total - montoDevuelto
            await supabase
              .from("ventas")
              .update({ total: nuevoTotal, updated_at: new Date().toISOString() })
              .eq("id", input.venta_id)
          }
        }
      } else {
        // ============================================
        // LOGICA DE CONTADO (sin cambios)
        // ============================================
        if (tipoFinal === "anulacion") {
          await supabase
            .from("ventas")
            .update({
              estado_venta: "cancelada",
              motivo_cancelacion: motivo,
              updated_at: new Date().toISOString(),
            })
            .eq("id", input.venta_id)
        }

        // Para contado con credito activo
        if (destino_monto === "abono_credito" || destino_monto === "ajuste_plan") {
          const { data: ventaActual } = await supabase
            .from("ventas")
            .select("total, linea_credito_id")
            .eq("id", input.venta_id)
            .single()

          if (ventaActual?.linea_credito_id) {
            const { data: linea } = await supabase
              .from("lineas_credito")
              .select("*")
              .eq("id", ventaActual.linea_credito_id)
              .single()

            if (linea) {
              const nuevoSaldoTotal = linea.saldo_total - montoDevuelto
              const newSaldoPendiente = nuevoSaldoTotal - linea.saldo_pagado

              const lineaUpdate: Record<string, unknown> = {
                saldo_total: nuevoSaldoTotal,
                updated_at: new Date().toISOString(),
              }
              if (newSaldoPendiente <= 0) {
                lineaUpdate.estado = "liquidada"
              }
              if (destino_monto === "ajuste_plan" && ajuste_plan) {
                lineaUpdate.meses_credito = ajuste_plan.meses_credito
                lineaUpdate.periodicidad = ajuste_plan.periodicidad
                lineaUpdate.fecha_siguiente_pago = ajuste_plan.fecha_siguiente_pago
              }
              await supabase.from("lineas_credito").update(lineaUpdate).eq("id", linea.id)
              montoAbonadoCredito = montoDevuelto
            }
          }
        } else {
          montoDevueltoEfectivo = montoDevuelto
        }
      }

      // 7. Registrar en historial
      const grupoRegla = tipo_venta_original === "credito"
        ? tiene_credito_activo_previo ? "con_credito_activo" : "sin_credito_activo"
        : "contado"

      await supabase.from("ventas_historial").insert({
        venta_id: input.venta_id,
        tipo: tipoFinal,
        usuario_id: input.vendedor_id,
        datos_anteriores: venta as unknown as Record<string, unknown>,
        datos_nuevos: {
          productos_devueltos,
          monto_devuelto: montoDevuelto,
          destino_monto,
          monto_abonado_credito: montoAbonadoCredito,
          monto_devuelto_efectivo: montoDevueltoEfectivo,
          grupo: grupoRegla,
          opcion_diferencia: opcion_diferencia ?? null,
        },
        motivo,
      })

      return {
        devolucion,
        tipo: tipoFinal,
        montoDevuelto,
        montoNuevo: 0,
        diferencia: montoDevuelto,
        montoAbonadoCredito,
        montoDevueltoEfectivo,
        creditoAbonadoFolio: "",
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
