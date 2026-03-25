"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Venta } from "@/lib/supabase/types"
import { toast } from "sonner"

interface ProductoDevueltoInput {
  producto_id: string
  cantidad: number
  estado_devuelto: "nuevo" | "parcial"
  precio_original: number
  precio_depreciado?: number
}

interface ProductoNuevoInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

interface DevolucionUnificadaInput {
  venta_id: string
  tipo: "devolucion" | "cambio" | "anulacion"
  vendedor_id: string
  cliente_id: string
  fecha: string
  motivo: string
  productos_devueltos: ProductoDevueltoInput[]
  productos_nuevos?: ProductoNuevoInput[]
  destino_monto: "efectivo" | "abono_credito" | null
  tipo_venta_original: "contado" | "credito"
}

export function useDevolucionUnificada() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DevolucionUnificadaInput) => {
      const {
        productos_devueltos,
        productos_nuevos,
        tipo_venta_original,
        destino_monto,
        motivo,
        ...baseData
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
      if (esDevolucionTotal && todosDevueltos && (!productos_nuevos || productos_nuevos.length === 0)) {
        tipoFinal = "anulacion"
      }

      // 3. Calcular montos
      const montoDevuelto = productos_devueltos.reduce((sum, p) => {
        const valor =
          p.estado_devuelto === "parcial" && p.precio_depreciado
            ? p.precio_depreciado * p.cantidad
            : p.precio_original * p.cantidad
        return sum + valor
      }, 0)

      const montoNuevo =
        productos_nuevos?.reduce(
          (sum, p) => sum + p.precio_unitario * p.cantidad,
          0
        ) ?? 0

      const diferencia = montoDevuelto - montoNuevo

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
          monto_nuevo: tipoFinal === "cambio" ? montoNuevo : null,
          diferencia: tipoFinal === "cambio" ? diferencia : montoDevuelto,
          notas: motivo,
        })
        .select()
        .single()
      if (devError) throw devError

      // 5. Insertar detalle de productos devueltos
      for (const p of productos_devueltos) {
        const precioUsado =
          p.estado_devuelto === "parcial" && p.precio_depreciado
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

        // 6. Revertir inventario
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
          // Producto parcial: buscar derivado existente o crear uno nuevo
          const { data: prod } = await supabase
            .from("productos")
            .select("*")
            .eq("id", p.producto_id)
            .single()
          if (!prod) continue

          const origenId = prod.producto_origen_id || prod.id

          // Buscar si ya existe un derivado parcial del mismo producto origen
          const { data: derivadoExistente } = await supabase
            .from("productos")
            .select("id, stock_actual")
            .eq("producto_origen_id", origenId)
            .eq("estado_producto", "parcial")
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
            // Crear nuevo producto derivado parcial
            await supabase.from("productos").insert({
              nombre: prod.nombre,
              marca: prod.marca,
              sku: prod.sku,
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
              estado_producto: "parcial",
              activo: true,
            })
          }
        }
      }

      // 7. Procesar productos nuevos (cambio)
      if (tipoFinal === "cambio" && productos_nuevos) {
        for (const p of productos_nuevos) {
          await supabase.from("devoluciones_detalle").insert({
            devolucion_id: devolucion.id,
            tipo: "nuevo",
            producto_id: p.producto_id,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
          })

          // Decrementar stock
          const { data: prod } = await supabase
            .from("productos")
            .select("stock_actual")
            .eq("id", p.producto_id)
            .single()
          const stockAntes = prod?.stock_actual ?? 0

          await supabase
            .from("productos")
            .update({
              stock_actual: stockAntes - p.cantidad,
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.producto_id)

          await supabase.from("stock_movimientos").insert({
            producto_id: p.producto_id,
            tipo: "SALIDA_VENTA",
            cantidad: p.cantidad,
            stock_antes: stockAntes,
            stock_despues: stockAntes - p.cantidad,
            referencia_id: devolucion.id,
            referencia_tipo: "cambio",
          })
        }
      }

      // 8. Si es anulación, marcar venta como cancelada
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
        }
      }

      // 9. Resolución del monto
      let montoResolver = tipoFinal === "cambio" ? diferencia : montoDevuelto
      let montoDevueltoEfectivo = 0
      let montoAbonadoCredito = 0
      let creditoAbonadoFolio = ""

      if (montoResolver > 0) {
        // Si la venta original es de crédito: ajustar el total del mismo crédito
        if (tipo_venta_original === "credito" && tipoFinal !== "anulacion") {
          const { data: ventaActual } = await supabase
            .from("ventas")
            .select("total")
            .eq("id", input.venta_id)
            .single()

          if (ventaActual) {
            const nuevoTotal = ventaActual.total - montoResolver
            await supabase
              .from("ventas")
              .update({ total: nuevoTotal, updated_at: new Date().toISOString() })
              .eq("id", input.venta_id)

            // Verificar si los abonos ya hechos superan el nuevo total (excedente)
            const pagos = (venta as unknown as { pagos: Array<{ monto: number }> }).pagos
            const totalPagado = pagos.reduce((sum, pg) => sum + pg.monto, 0)

            if (totalPagado > nuevoTotal) {
              // Hay excedente — tratar como monto por resolver
              montoResolver = totalPagado - nuevoTotal

              // Verificar si queda liquidado
              if (totalPagado >= nuevoTotal) {
                await supabase
                  .from("ventas")
                  .update({ estado_credito: "liquidado", updated_at: new Date().toISOString() })
                  .eq("id", input.venta_id)
              }
            } else {
              montoResolver = 0 // No hay excedente, el ajuste fue suficiente
            }
          }
        }

        // Cadena: abonar a crédito pendiente → efectivo
        if (montoResolver > 0 && destino_monto === "abono_credito") {
          // Buscar créditos activos del cliente (excluyendo la venta actual)
          const { data: ventasCredito } = await supabase
            .from("ventas")
            .select("id, total, folio")
            .eq("cliente_id", input.cliente_id)
            .eq("tipo_venta", "credito")
            .eq("estado_credito", "activo")
            .neq("id", input.venta_id)

          for (const vc of ventasCredito ?? []) {
            if (montoResolver <= 0) break

            // Cuánto falta por pagar en este crédito
            const { data: pagosVC } = await supabase
              .from("pagos")
              .select("monto")
              .eq("venta_id", vc.id)
            const pagadoVC = (pagosVC ?? []).reduce((s, p) => s + p.monto, 0)
            const pendienteVC = vc.total - pagadoVC

            if (pendienteVC <= 0) continue

            const abonar = Math.min(montoResolver, pendienteVC)

            await supabase.from("pagos").insert({
              venta_id: vc.id,
              monto: abonar,
              tipo_pago: "devolucion",
              referencia_devolucion_id: devolucion.id,
              vendedor_id: input.vendedor_id,
              cliente_id: input.cliente_id,
            })

            montoAbonadoCredito += abonar
            creditoAbonadoFolio = vc.folio
            montoResolver -= abonar

            // Si queda liquidado
            if (pagadoVC + abonar >= vc.total) {
              await supabase
                .from("ventas")
                .update({ estado_credito: "liquidado", updated_at: new Date().toISOString() })
                .eq("id", vc.id)
            }
          }
        }

        // Lo que quede se devuelve en efectivo
        if (montoResolver > 0) {
          montoDevueltoEfectivo = montoResolver
        }
      }

      // 10. Registrar en historial
      await supabase.from("ventas_historial").insert({
        venta_id: input.venta_id,
        tipo: tipoFinal,
        usuario_id: input.vendedor_id,
        datos_anteriores: venta as unknown as Record<string, unknown>,
        datos_nuevos: {
          productos_devueltos,
          productos_nuevos: productos_nuevos ?? [],
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
      const msg =
        data.tipo === "anulacion"
          ? "Venta anulada exitosamente"
          : data.tipo === "cambio"
            ? "Cambio registrado exitosamente"
            : "Devolución registrada exitosamente"
      toast.success(msg)
    },
    onError: () => toast.error("Error al procesar la operación"),
  })
}
