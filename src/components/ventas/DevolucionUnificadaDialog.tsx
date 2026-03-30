"use client"

import { useState, useMemo } from "react"
import { type VentaFullDetail } from "@/hooks/useVentas"
import { useDevolucionUnificada } from "@/hooks/useDevolucionUnificada"
import { useLineaCreditoCliente } from "@/hooks/useLineaCredito"
import { AbonoCobranzaDialog } from "@/components/cobranza/AbonoCobranzaDialog"
import { DevolucionTicketPDF } from "@/components/ventas/DevolucionTicketPDF"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatMoney } from "@/lib/utils"
import { pdf } from "@react-pdf/renderer"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Share2,
  Download,
} from "lucide-react"
import type { CreditoCobranza } from "@/hooks/useCobranza"

interface Props {
  venta: VentaFullDetail
  vendedorId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ProductoDevuelto {
  producto_id: string
  nombre: string
  cantidad_max: number
  cantidad: number
  estado_devuelto: "nuevo" | "segunda" | "parcial"
  precio_original: number
  precio_depreciado: number
  porcentaje: number // percentage for segunda/parcial (1-100)
  seleccionado: boolean
  // Info de la compra original
  estado_compra: string // "nuevo" | "segunda" | "parcial"
  porcentaje_compra: number | null // % aplicado en la compra, null si fue nuevo/100%
}

type Paso = 1 | 2 | 3

export function DevolucionUnificadaDialog({
  venta,
  vendedorId,
  open,
  onOpenChange,
}: Props) {
  const mutation = useDevolucionUnificada()
  const { data: lineaActiva } = useLineaCreditoCliente(venta.cliente_id)

  // State
  const [paso, setPaso] = useState<Paso>(1)
  const [motivo, setMotivo] = useState("")
  const [destinoMonto, setDestinoMonto] = useState<"efectivo" | "abono_credito" | "ajuste_plan" | null>(null)
  const [opcionAjuste, setOpcionAjuste] = useState<"reducir_periodos" | "reducir_cuotas" | "adelanto">("reducir_periodos")
  const [showAbonoDialog, setShowAbonoDialog] = useState(false)
  const [resultadoExitoso, setResultadoExitoso] = useState<{
    tipo: string
    montoDevuelto: number
    montoAbonadoCredito: number
    montoDevueltoEfectivo: number
  } | null>(null)

  // Productos de la venta como devueltos seleccionables
  const [productosDevueltos, setProductosDevueltos] = useState<ProductoDevuelto[]>(
    () =>
      (venta.ventas_detalle ?? []).map((d) => {
        const estadoProd = d.productos?.estado_producto ?? "nuevo"
        const precioRef = venta.tipo_venta === "contado"
          ? (d.productos as Record<string, unknown>)?.precio_venta_contado as number | undefined
          : (d.productos as Record<string, unknown>)?.precio_venta_credito as number | undefined
        const pctCompra = precioRef && precioRef > 0 && estadoProd !== "nuevo"
          ? Math.round((d.precio_unitario / precioRef) * 100)
          : null
        return {
          producto_id: d.producto_id,
          nombre: d.productos?.nombre ?? "—",
          cantidad_max: d.cantidad,
          cantidad: d.cantidad,
          estado_devuelto: "nuevo" as const,
          precio_original: d.precio_unitario,
          precio_depreciado: d.precio_unitario,
          porcentaje: 50,
          seleccionado: false,
          estado_compra: estadoProd,
          porcentaje_compra: pctCompra,
        }
      })
  )

  // Validacion de 7 dias
  const fechaVenta = new Date(venta.fecha)
  const hoy = new Date()
  const diffDias = (hoy.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24)
  const dentroDelPlazo = diffDias <= 7

  // Calculos
  const productosSeleccionados = productosDevueltos.filter((p) => p.seleccionado)

  const montoDevuelto = useMemo(
    () =>
      productosSeleccionados.reduce((sum, p) => {
        if (p.estado_devuelto === "nuevo") {
          return sum + p.precio_original * p.cantidad
        }
        return sum + p.precio_depreciado * p.cantidad
      }, 0),
    [productosSeleccionados]
  )

  const tipoVentaOriginal = venta.tipo_venta as "contado" | "credito"

  // Detectar si es anulacion
  const esAnulacion = useMemo(() => {
    if (productosSeleccionados.length !== (venta.ventas_detalle ?? []).length) return false
    return productosSeleccionados.every(
      (p) => p.estado_devuelto === "nuevo" && p.cantidad >= p.cantidad_max
    )
  }, [productosSeleccionados, venta.ventas_detalle])

  // Adjustment preview calculation (for credit ventas)
  const ajustePreview = useMemo(() => {
    if (!lineaActiva || montoDevuelto <= 0) return null

    const nuevoSaldo = (lineaActiva.saldo_total - montoDevuelto) - lineaActiva.saldo_pagado
    if (nuevoSaldo <= 0) return null

    const factor = lineaActiva.periodicidad === "semanal" ? 4 : lineaActiva.periodicidad === "quincenal" ? 2 : 1
    const periodosActuales = lineaActiva.meses_credito * factor
    const cuotaActual = Math.ceil(((lineaActiva.saldo_total - lineaActiva.saldo_pagado) / periodosActuales) * 100) / 100

    // Option A: reduce periods
    const nuevosPeriodosA = Math.max(1, Math.ceil(nuevoSaldo / cuotaActual))
    const nuevaCuotaA = Math.ceil((nuevoSaldo / nuevosPeriodosA) * 100) / 100
    const nuevosMesesA = Math.max(1, Math.ceil(nuevosPeriodosA / factor))

    // Option B: reduce cuotas
    const nuevaCuotaB = Math.ceil((nuevoSaldo / periodosActuales) * 100) / 100

    return {
      nuevoSaldo,
      cuotaActual,
      periodosActuales,
      opcionA: { periodos: nuevosPeriodosA, cuota: nuevaCuotaA, meses: nuevosMesesA },
      opcionB: { periodos: periodosActuales, cuota: nuevaCuotaB, meses: lineaActiva.meses_credito },
    }
  }, [lineaActiva, montoDevuelto])

  function handleSeleccionarTodos() {
    setProductosDevueltos((prev) =>
      prev.map((p) => ({
        ...p,
        seleccionado: true,
        cantidad: p.cantidad_max,
        estado_devuelto: "nuevo" as const,
      }))
    )
  }

  function handleDeseleccionarTodos() {
    setProductosDevueltos((prev) =>
      prev.map((p) => ({ ...p, seleccionado: false }))
    )
  }

  function updateProductoDevuelto(index: number, field: Partial<ProductoDevuelto>) {
    setProductosDevueltos((prev) =>
      prev.map((p, i) => {
        if (i !== index) return p
        const updated = { ...p, ...field }
        // Recalculate precio_depreciado from porcentaje ONLY if precio_depreciado
        // was NOT explicitly set in this update (avoid overwriting manual price input)
        const precioSetManually = field.precio_depreciado !== undefined
        if (
          !precioSetManually &&
          (field.porcentaje !== undefined || field.estado_devuelto !== undefined)
        ) {
          const estado = field.estado_devuelto ?? p.estado_devuelto
          const pct = field.porcentaje ?? p.porcentaje
          if (estado === "segunda" || estado === "parcial") {
            updated.precio_depreciado = Math.round(p.precio_original * pct / 100 * 100) / 100
          } else {
            updated.precio_depreciado = p.precio_original
          }
        }
        return updated
      })
    )
  }

  function getSubtotal(p: ProductoDevuelto): number {
    if (p.estado_devuelto === "nuevo") {
      return p.precio_original * p.cantidad
    }
    return p.precio_depreciado * p.cantidad
  }

  async function handleConfirmar() {
    // Calculate meses for ajuste_plan
    let mesesCredito = lineaActiva?.meses_credito ?? 1
    if (destinoMonto === "ajuste_plan" && ajustePreview && lineaActiva) {
      if (opcionAjuste === "reducir_periodos") {
        mesesCredito = ajustePreview.opcionA.meses
      } else if (opcionAjuste === "reducir_cuotas") {
        mesesCredito = ajustePreview.opcionB.meses
      }
      // adelanto: keep same meses
    }

    mutation.mutate(
      {
        venta_id: venta.id,
        tipo: esAnulacion ? "anulacion" : "devolucion",
        vendedor_id: vendedorId,
        cliente_id: venta.cliente_id,
        fecha: new Date().toISOString().split("T")[0],
        motivo,
        productos_devueltos: productosSeleccionados.map((p) => ({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          estado_devuelto: p.estado_devuelto,
          precio_original: p.precio_original,
          precio_depreciado: p.estado_devuelto !== "nuevo" ? p.precio_depreciado : undefined,
          porcentaje_parcial: p.estado_devuelto === "parcial" ? p.porcentaje : undefined,
        })),
        destino_monto: destinoMonto,
        tipo_venta_original: tipoVentaOriginal,
        ajuste_plan:
          destinoMonto === "ajuste_plan" && lineaActiva
            ? {
                meses_credito: mesesCredito,
                periodicidad: lineaActiva.periodicidad,
                fecha_siguiente_pago: lineaActiva.fecha_siguiente_pago ?? "",
              }
            : undefined,
      },
      {
        onSuccess: (data) => {
          if (destinoMonto === "abono_credito" && lineaActiva) {
            // For contado + credit: show abono dialog
            setResultadoExitoso(data)
            setShowAbonoDialog(true)
          } else {
            setResultadoExitoso(data)
          }
        },
      }
    )
  }

  async function handleSharePDF() {
    if (!resultadoExitoso) return
    const element = buildPDFElement()
    const blob = await pdf(element).toBlob()
    await sharePDF(blob, `devolucion-${venta.folio}.pdf`, `Devolucion ${venta.folio}`)
  }

  async function handleDownloadPDF() {
    if (!resultadoExitoso) return
    const element = buildPDFElement()
    const blob = await pdf(element).toBlob()
    await downloadPDF(blob, `devolucion-${venta.folio}.pdf`)
  }

  function buildPDFElement() {
    const tipoLabel = esAnulacion ? "anulacion" : "devolucion"
    return (
      <DevolucionTicketPDF
        folio={venta.folio}
        fecha={new Date().toISOString()}
        clienteNombre={venta.clientes?.nombre ?? ""}
        clienteTelefono={venta.clientes?.telefono}
        vendedorNombre={venta.vendedores?.nombre ?? ""}
        tipo={tipoLabel as "devolucion" | "cambio" | "anulacion"}
        productosDevueltos={productosSeleccionados.map((p) => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          estado: p.estado_devuelto,
          precioUnitario: p.estado_devuelto !== "nuevo" ? p.precio_depreciado : p.precio_original,
          subtotal: getSubtotal(p),
        }))}
        montoDevuelto={montoDevuelto}
        diferencia={montoDevuelto}
        resolucion={{
          abonoCredito: resultadoExitoso?.montoAbonadoCredito
            ? { monto: resultadoExitoso.montoAbonadoCredito, creditoRef: "" }
            : undefined,
          reembolsoEfectivo: resultadoExitoso?.montoDevueltoEfectivo || undefined,
        }}
        motivo={motivo}
      />
    )
  }

  // Build CreditoCobranza object for AbonoCobranzaDialog
  const creditoCobranzaParaAbono: CreditoCobranza | null = useMemo(() => {
    if (!lineaActiva) return null
    const saldoPendiente = lineaActiva.saldo_total - lineaActiva.saldo_pagado
    const factor = lineaActiva.periodicidad === "semanal" ? 4 : lineaActiva.periodicidad === "quincenal" ? 2 : 1
    const periodos = Math.max(1, lineaActiva.meses_credito * factor)
    const cuota = Math.ceil((saldoPendiente / periodos) * 100) / 100
    return {
      id: lineaActiva.id,
      cliente_id: lineaActiva.cliente_id,
      saldo_total: lineaActiva.saldo_total,
      saldo_pagado: lineaActiva.saldo_pagado,
      saldo_pendiente: saldoPendiente,
      saldo_restante: saldoPendiente,
      meses_credito: lineaActiva.meses_credito,
      periodicidad: lineaActiva.periodicidad,
      fecha_inicio: lineaActiva.fecha_inicio ?? "",
      fecha_siguiente_pago: lineaActiva.fecha_siguiente_pago ?? null,
      fecha_cobro_especifica: null,
      estado: lineaActiva.estado ?? "activa",
      created_at: lineaActiva.created_at ?? "",
      clientes: lineaActiva.clientes ?? null,
      vendedores: lineaActiva.vendedores ?? null,
      vendedor_id: lineaActiva.vendedor_id ?? null,
      atendido: false,
      periodo_inicio: "",
      periodo_fin: "",
      abono_en_periodo: false,
      ultimo_pago_fecha: null,
      ultimo_pago_monto: null,
      cuota_programada: cuota,
      estado_periodo: "sin_abonos" as const,
    }
  }, [lineaActiva])

  function handleCerrar() {
    setPaso(1)
    setMotivo("")
    setDestinoMonto(null)
    setOpcionAjuste("reducir_periodos")
    setShowAbonoDialog(false)
    setResultadoExitoso(null)
    setProductosDevueltos(
      (venta.ventas_detalle ?? []).map((d) => {
        const estadoProd = d.productos?.estado_producto ?? "nuevo"
        const precioRef = venta.tipo_venta === "contado"
          ? (d.productos as Record<string, unknown>)?.precio_venta_contado as number | undefined
          : (d.productos as Record<string, unknown>)?.precio_venta_credito as number | undefined
        const pctCompra = precioRef && precioRef > 0 && estadoProd !== "nuevo"
          ? Math.round((d.precio_unitario / precioRef) * 100)
          : null
        return {
          producto_id: d.producto_id,
          nombre: d.productos?.nombre ?? "—",
          cantidad_max: d.cantidad,
          cantidad: d.cantidad,
          estado_devuelto: "nuevo" as const,
          precio_original: d.precio_unitario,
          precio_depreciado: d.precio_unitario,
          porcentaje: 50,
          seleccionado: false,
          estado_compra: estadoProd,
          porcentaje_compra: pctCompra,
        }
      })
    )
    onOpenChange(false)
  }

  // AbonoCobranzaDialog for contado + credit
  if (showAbonoDialog && creditoCobranzaParaAbono) {
    return (
      <AbonoCobranzaDialog
        credito={creditoCobranzaParaAbono}
        open={showAbonoDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowAbonoDialog(false)
            // After closing abono dialog, show success
          }
        }}
      />
    )
  }

  // Resultado exitoso -- pantalla de confirmacion
  if (resultadoExitoso && !showAbonoDialog) {
    return (
      <Dialog open={open} onOpenChange={handleCerrar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Operacion completada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-green-50 border border-green-200 p-4 text-center dark:bg-green-950 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200 font-medium">
                {resultadoExitoso.tipo === "anulacion"
                  ? "Venta anulada exitosamente"
                  : "Devolucion registrada exitosamente"}
              </p>
            </div>
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Monto devuelto:</span>
                <span className="font-medium">{formatMoney(resultadoExitoso.montoDevuelto)}</span>
              </div>
              {resultadoExitoso.montoDevueltoEfectivo > 0 && (
                <div className="flex justify-between">
                  <span>Devuelto en efectivo:</span>
                  <span className="font-medium">{formatMoney(resultadoExitoso.montoDevueltoEfectivo)}</span>
                </div>
              )}
              {resultadoExitoso.montoAbonadoCredito > 0 && (
                <div className="flex justify-between">
                  <span>Abonado al credito:</span>
                  <span className="font-medium">{formatMoney(resultadoExitoso.montoAbonadoCredito)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" className="gap-2" onClick={handleSharePDF}>
                <Share2 className="h-4 w-4" />
                Compartir
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleCerrar}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Devolucion — {venta.folio}</DialogTitle>
        </DialogHeader>

        {!dentroDelPlazo && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Fuera del plazo de 7 dias. No se puede procesar.
          </div>
        )}

        {dentroDelPlazo && (
          <div className="space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {[1, 2, 3].map((p) => (
                <div key={p} className="flex items-center gap-1">
                  <div
                    className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      paso >= p
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p}
                  </div>
                  {p < 3 && <div className="w-8 h-px bg-border" />}
                </div>
              ))}
            </div>

            {/* ============================================================ */}
            {/* PASO 1: Seleccion de productos                               */}
            {/* ============================================================ */}
            {paso === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Productos a devolver</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSeleccionarTodos}>
                      Seleccionar todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDeseleccionarTodos}>
                      Limpiar
                    </Button>
                  </div>
                </div>

                {/* Product cards (responsive) */}
                <div className="space-y-2">
                  {productosDevueltos.map((p, i) => {
                    const subtotal = getSubtotal(p)

                    return (
                      <div
                        key={p.producto_id}
                        className={`rounded-lg border p-3 space-y-2 ${!p.seleccionado ? "opacity-50" : ""}`}
                      >
                        {/* Row 1: Checkbox + name */}
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={p.seleccionado}
                            onCheckedChange={(checked) =>
                              updateProductoDevuelto(i, { seleccionado: !!checked })
                            }
                          />
                          <span className="text-sm font-medium flex-1">
                            {p.nombre}
                            {p.estado_compra !== "nuevo" && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 align-middle">
                                {p.estado_compra === "parcial" ? "Parcial" : "Segunda"}
                                {p.porcentaje_compra !== null ? ` ${p.porcentaje_compra}%` : ""}
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMoney(p.precio_original)} c/u
                          </span>
                        </div>

                        {/* Row 2: Quantity + Estado */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Label className="text-xs text-muted-foreground">Cant:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={p.cantidad_max}
                              value={p.cantidad}
                              onChange={(e) =>
                                updateProductoDevuelto(i, {
                                  cantidad: Math.max(1, Math.min(Number(e.target.value), p.cantidad_max)),
                                })
                              }
                              className="w-16 text-right h-8"
                              disabled={!p.seleccionado}
                            />
                            <span className="text-xs text-muted-foreground">/ {p.cantidad_max}</span>
                          </div>
                          <Select
                            value={p.estado_devuelto}
                            onValueChange={(v) =>
                              updateProductoDevuelto(i, {
                                estado_devuelto: v as "nuevo" | "segunda" | "parcial",
                              })
                            }
                            disabled={!p.seleccionado}
                          >
                            <SelectTrigger className="h-8 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nuevo">Nuevo</SelectItem>
                              <SelectItem value="segunda">Segunda</SelectItem>
                              <SelectItem value="parcial">Parcial</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Row 3: Percentage slider + price input for segunda/parcial */}
                        {(p.estado_devuelto === "segunda" || p.estado_devuelto === "parcial") && p.seleccionado && (
                          <div className="space-y-1.5 pl-6">
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={1}
                                max={100}
                                value={p.porcentaje}
                                onChange={(e) =>
                                  updateProductoDevuelto(i, { porcentaje: Number(e.target.value) })
                                }
                                className="flex-1 h-2 accent-primary"
                              />
                              <Input
                                type="number"
                                min={1}
                                max={100}
                                value={p.porcentaje}
                                onChange={(e) =>
                                  updateProductoDevuelto(i, {
                                    porcentaje: Math.max(1, Math.min(100, Number(e.target.value))),
                                  })
                                }
                                className="w-16 text-right h-8"
                              />
                              <span className="text-xs text-muted-foreground shrink-0">%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground shrink-0">Precio:</span>
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                max={p.precio_original}
                                value={p.precio_depreciado}
                                onChange={(e) => {
                                  const precio = Math.max(0, Math.min(p.precio_original, Number(e.target.value)))
                                  const pct = p.precio_original > 0 ? Math.round((precio / p.precio_original) * 100) : 0
                                  updateProductoDevuelto(i, {
                                    precio_depreciado: precio,
                                    porcentaje: Math.max(1, Math.min(100, pct)),
                                  })
                                }}
                                className="w-24 h-8"
                              />
                              <span className="text-xs text-muted-foreground">
                                de {formatMoney(p.precio_original)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Row 4: Subtotal */}
                        <div className="text-right text-sm">
                          Subtotal:{" "}
                          <span className="font-mono">
                            {p.seleccionado ? formatMoney(subtotal) : "—"}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {productosSeleccionados.length} producto(s) seleccionado(s)
                  </p>
                  <p className="font-medium">Total: {formatMoney(montoDevuelto)}</p>
                </div>

                {/* Navigation */}
                <div className="flex justify-end">
                  <Button
                    onClick={() => setPaso(2)}
                    disabled={productosSeleccionados.length === 0}
                    className="gap-2"
                  >
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* PASO 2: Destino del monto                                    */}
            {/* ============================================================ */}
            {paso === 2 && (
              <div className="space-y-4">
                <h3 className="font-medium">Destino del monto</h3>

                <div className="rounded-md bg-muted p-3">
                  <div className="text-center mb-2">
                    <p className="text-sm text-muted-foreground">Monto a ajustar</p>
                    <p className="text-2xl font-bold">{formatMoney(montoDevuelto)}</p>
                  </div>
                  {tipoVentaOriginal === "credito" && lineaActiva && (
                    <div className="grid grid-cols-2 gap-2 text-center border-t pt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Saldo actual</p>
                        <p className="text-sm font-mono font-medium">{formatMoney(lineaActiva.saldo_total - lineaActiva.saldo_pagado)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Saldo con ajuste</p>
                        <p className="text-sm font-mono font-medium text-green-600">{formatMoney(Math.max(0, (lineaActiva.saldo_total - montoDevuelto) - lineaActiva.saldo_pagado))}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* CONTADO + NO credit line */}
                {tipoVentaOriginal === "contado" && !lineaActiva && (
                  <div className="rounded-md border p-3 text-sm">
                    Reembolso en efectivo: <strong>{formatMoney(montoDevuelto)}</strong>
                  </div>
                )}

                {/* CONTADO + HAS credit line */}
                {tipoVentaOriginal === "contado" && lineaActiva && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      El cliente tiene un credito activo. Selecciona el destino del monto:
                    </p>
                    <div
                      onClick={() => setDestinoMonto("efectivo")}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        destinoMonto === "efectivo" || destinoMonto === null
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            destinoMonto === "efectivo" || destinoMonto === null
                              ? "border-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {(destinoMonto === "efectivo" || destinoMonto === null) && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-medium text-sm">Reembolso en efectivo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-6">
                        Se reembolsan {formatMoney(montoDevuelto)} en efectivo al cliente.
                      </p>
                    </div>
                    <div
                      onClick={() => setDestinoMonto("abono_credito")}
                      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                        destinoMonto === "abono_credito"
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                            destinoMonto === "abono_credito" ? "border-primary" : "border-muted-foreground/30"
                          }`}
                        >
                          {destinoMonto === "abono_credito" && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <span className="font-medium text-sm">Abonar al credito activo</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 pl-6">
                        Saldo actual: {formatMoney(lineaActiva.saldo_total - lineaActiva.saldo_pagado)} → Con ajuste: {formatMoney(Math.max(0, (lineaActiva.saldo_total - lineaActiva.saldo_pagado) - montoDevuelto))}
                      </p>
                    </div>
                  </div>
                )}

                {/* CREDITO */}
                {tipoVentaOriginal === "credito" && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      El monto se ajustara en el saldo del credito.
                    </div>

                    {ajustePreview && lineaActiva && (() => {
                      // Ensure destinoMonto is set to ajuste_plan for credit
                      if (destinoMonto !== "ajuste_plan") {
                        // Use a timeout to avoid state updates during render
                        setTimeout(() => setDestinoMonto("ajuste_plan"), 0)
                      }
                      return null
                    })()}

                    {ajustePreview && lineaActiva && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Selecciona como ajustar el plan de pagos:
                        </p>

                        {/* Option A: Reducir periodos */}
                        <div
                          onClick={() => {
                            setDestinoMonto("ajuste_plan")
                            setOpcionAjuste("reducir_periodos")
                          }}
                          className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                            opcionAjuste === "reducir_periodos"
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                opcionAjuste === "reducir_periodos" ? "border-primary" : "border-muted-foreground/30"
                              }`}
                            >
                              {opcionAjuste === "reducir_periodos" && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <span className="font-medium text-sm">Reducir periodos</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 pl-6 space-y-0.5">
                            <p>Periodos: {ajustePreview.periodosActuales} → {ajustePreview.opcionA.periodos}</p>
                            <p>Cuota: {formatMoney(ajustePreview.cuotaActual)} → {formatMoney(ajustePreview.opcionA.cuota)}</p>
                            <p>Meses: {lineaActiva.meses_credito} → {ajustePreview.opcionA.meses}</p>
                          </div>
                        </div>

                        {/* Option B: Reducir cuotas */}
                        <div
                          onClick={() => {
                            setDestinoMonto("ajuste_plan")
                            setOpcionAjuste("reducir_cuotas")
                          }}
                          className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                            opcionAjuste === "reducir_cuotas"
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                opcionAjuste === "reducir_cuotas" ? "border-primary" : "border-muted-foreground/30"
                              }`}
                            >
                              {opcionAjuste === "reducir_cuotas" && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <span className="font-medium text-sm">Reducir cuotas</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 pl-6 space-y-0.5">
                            <p>Periodos: {ajustePreview.opcionB.periodos} (sin cambio)</p>
                            <p>Cuota: {formatMoney(ajustePreview.cuotaActual)} → {formatMoney(ajustePreview.opcionB.cuota)}</p>
                          </div>
                        </div>

                        {/* Option C: Adelanto */}
                        <div
                          onClick={() => {
                            setDestinoMonto("ajuste_plan")
                            setOpcionAjuste("adelanto")
                          }}
                          className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                            opcionAjuste === "adelanto"
                              ? "border-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                opcionAjuste === "adelanto" ? "border-primary" : "border-muted-foreground/30"
                              }`}
                            >
                              {opcionAjuste === "adelanto" && (
                                <div className="h-2 w-2 rounded-full bg-primary" />
                              )}
                            </div>
                            <span className="font-medium text-sm">Adelanto</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 pl-6 space-y-0.5">
                            <p>Se descuenta del saldo sin cambiar el plan.</p>
                            <p>Nuevo saldo: {formatMoney(ajustePreview.nuevoSaldo)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {!ajustePreview && lineaActiva && (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        El descuento liquida el saldo restante del credito. No se requiere ajuste de plan.
                      </div>
                    )}

                    {!lineaActiva && (
                      <div className="rounded-md border p-3 text-sm text-muted-foreground">
                        No se encontro una linea de credito activa. El monto se ajustara sobre la venta.
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setPaso(1)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Atras
                  </Button>
                  <Button onClick={() => setPaso(3)} className="gap-2">
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* PASO 3: Confirmacion                                         */}
            {/* ============================================================ */}
            {paso === 3 && (
              <div className="space-y-4">
                <h3 className="font-medium">Confirmar operacion</h3>

                {esAnulacion && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Esta accion anulara la venta completa.
                  </div>
                )}

                {/* Summary */}
                <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                  <p>
                    <strong>Tipo:</strong>{" "}
                    <Badge variant={esAnulacion ? "destructive" : "secondary"}>
                      {esAnulacion ? "Anulacion" : "Devolucion"}
                    </Badge>
                  </p>

                  <div className="space-y-1 mt-2">
                    <p className="font-medium text-xs text-muted-foreground uppercase">Productos</p>
                    {productosSeleccionados.map((p) => (
                      <div key={p.producto_id} className="flex justify-between text-xs">
                        <span>
                          {p.nombre} x{p.cantidad}
                          {p.estado_devuelto !== "nuevo" && (
                            <Badge variant="outline" className="ml-1 text-[10px] py-0">
                              {p.estado_devuelto} {p.porcentaje}%
                            </Badge>
                          )}
                        </span>
                        <span className="font-mono">{formatMoney(getSubtotal(p))}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between border-t pt-1 mt-1">
                    <strong>Total:</strong>
                    <span className="font-bold">{formatMoney(montoDevuelto)}</span>
                  </div>

                  {/* Destino info */}
                  <div className="border-t pt-1 mt-1">
                    <p>
                      <strong>Destino:</strong>{" "}
                      {tipoVentaOriginal === "credito"
                        ? opcionAjuste === "reducir_periodos"
                          ? "Ajuste de credito (reducir periodos)"
                          : opcionAjuste === "reducir_cuotas"
                            ? "Ajuste de credito (reducir cuotas)"
                            : "Ajuste de credito (adelanto)"
                        : destinoMonto === "abono_credito"
                          ? "Abonar al credito activo"
                          : "Devolucion en efectivo"}
                    </p>
                  </div>

                  {/* Adjustment preview */}
                  {tipoVentaOriginal === "credito" && ajustePreview && (
                    <div className="border-t pt-1 mt-1 text-xs space-y-0.5">
                      <p className="font-medium text-muted-foreground uppercase">Vista previa del ajuste</p>
                      {opcionAjuste === "reducir_periodos" && (
                        <>
                          <p>Periodos: {ajustePreview.periodosActuales} → {ajustePreview.opcionA.periodos}</p>
                          <p>Cuota: {formatMoney(ajustePreview.cuotaActual)} → {formatMoney(ajustePreview.opcionA.cuota)}</p>
                        </>
                      )}
                      {opcionAjuste === "reducir_cuotas" && (
                        <>
                          <p>Periodos: {ajustePreview.opcionB.periodos} (sin cambio)</p>
                          <p>Cuota: {formatMoney(ajustePreview.cuotaActual)} → {formatMoney(ajustePreview.opcionB.cuota)}</p>
                        </>
                      )}
                      {opcionAjuste === "adelanto" && (
                        <p>Nuevo saldo: {formatMoney(ajustePreview.nuevoSaldo)}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Motivo */}
                <div className="space-y-2">
                  <Label htmlFor="motivo-confirmacion">Motivo / Razon *</Label>
                  <Textarea
                    id="motivo-confirmacion"
                    placeholder="Describe el motivo de la operacion..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={3}
                  />
                  {motivo.length > 0 && motivo.length < 10 && (
                    <p className="text-xs text-destructive">
                      El motivo debe tener al menos 10 caracteres
                    </p>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setPaso(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Atras
                  </Button>
                  <Button
                    variant={esAnulacion ? "destructive" : "default"}
                    onClick={handleConfirmar}
                    disabled={mutation.isPending || motivo.length < 10}
                  >
                    {mutation.isPending
                      ? "Procesando..."
                      : esAnulacion
                        ? "Confirmar Anulacion"
                        : "Confirmar"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
