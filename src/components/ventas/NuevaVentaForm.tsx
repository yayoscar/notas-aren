"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { pdf } from "@react-pdf/renderer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ClienteAutocomplete } from "./ClienteAutocomplete"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ProductoSelector } from "./ProductoSelector"
import { VentaDetalleTable } from "./VentaDetalleTable"
import { PagoForm } from "./PagoForm"
import { CreditoFields } from "./CreditoFields"
import { VentaTicketPDF } from "./VentaTicketPDF"
import { TablaPagosPDF } from "./TablaPagosPDF"
import { useVentas } from "@/hooks/useVentas"
import { useClientes } from "@/hooks/useClientes"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { useLineaCreditoCliente, useUltimoPagoLinea } from "@/hooks/useLineaCredito"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import { formatMoney, localToday, formatDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { CheckCircle2, Share2, Download } from "lucide-react"
import type { Producto } from "@/lib/supabase/types"
import type { VentaDetalleValues } from "@/lib/validations/venta.schema"
import type { TipoVenta } from "@/lib/supabase/types"

const TIPO_PAGO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  retiro_sin_tarjeta: "Retiro sin tarjeta",
}

export function NuevaVentaForm() {
  const router = useRouter()
  const { create } = useVentas()
  const { query: clientesQuery } = useClientes()
  const { vendedor } = useVendedorActual()

  const today = localToday()

  const [clienteId, setClienteId] = useState("")
  const [tipoVenta, setTipoVenta] = useState<TipoVenta>("contado")
  const [fecha, setFecha] = useState(today)
  const [detalles, setDetalles] = useState<VentaDetalleValues[]>([])

  // Pago contado
  const [pagoMonto, setPagoMonto] = useState(0)
  const [pagoTipo, setPagoTipo] = useState("")
  const [pagoCuenta, setPagoCuenta] = useState<string | null>(null)
  const [pagoCuentaAlias, setPagoCuentaAlias] = useState("")

  // Crédito
  const [mesesCredito, setMesesCredito] = useState(2)
  const [periodicidad, setPeriodicidad] = useState("quincenal")
  const [fechaPrimerPago, setFechaPrimerPago] = useState("")
  const [entregaDespuesPago, setEntregaDespuesPago] = useState(false)
  const [primerAbono, setPrimerAbono] = useState<{
    monto: number
    tipo_pago: string
    cuenta_bancaria_id: string | null
  } | null>(null)

  // Línea de crédito del cliente
  const lineaCreditoQuery = useLineaCreditoCliente(clienteId ?? "")
  const lineaActiva = lineaCreditoQuery.data
  const deudaAcumulada = lineaActiva
    ? lineaActiva.saldo_total - lineaActiva.saldo_pagado
    : 0

  // Ultimo pago de la linea activa
  const ultimoPagoQuery = useUltimoPagoLinea(lineaActiva?.id ?? "")

  // Ajuste de plan inline
  const [ajusteMeses, setAjusteMeses] = useState(2)
  const [ajustePeriodicidad, setAjustePeriodicidad] = useState("quincenal")
  const [ajusteFechaPago, setAjusteFechaPago] = useState("")

  useEffect(() => {
    if (lineaActiva) {
      setAjusteMeses(lineaActiva.meses_credito)
      setAjustePeriodicidad(lineaActiva.periodicidad)
      setAjusteFechaPago(lineaActiva.fecha_siguiente_pago ?? "")
    }
  }, [lineaActiva])

  // Parcial percentage
  const [pendingParcial, setPendingParcial] = useState<{ producto: Producto & Record<string, unknown>; preciosPadre: { contado: number; credito: number } } | null>(null)
  const [pendingTipoVenta, setPendingTipoVenta] = useState<TipoVenta | null>(null)
  const [porcentajeParcial, setPorcentajeParcial] = useState(50)
  const [precioParcial, setPrecioParcial] = useState<number | string>("")
  const [errorParcial, setErrorParcial] = useState("")

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Dialogs
  const [showConfirm, setShowConfirm] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [ventaCreada, setVentaCreada] = useState<{
    folio: string
    id: string
  } | null>(null)

  const total = detalles.reduce(
    (sum, d) => sum + d.cantidad * d.precio_unitario,
    0
  )

  const clientes = (clientesQuery.data ?? []).filter((c) => c.activo)
  const clienteNombre =
    clientes.find((c) => c.id === clienteId)?.nombre ?? ""
  const clienteTelefono =
    clientes.find((c) => c.id === clienteId)?.telefono ?? ""

  const handleAddProducto = useCallback(
    async (producto: Producto) => {
      // For parcial products with a parent, show percentage selector
      if ((producto.estado_producto === "parcial" || producto.estado_producto === "segunda") && (producto as Record<string, unknown>).producto_origen_id) {
        const supabase = createClient()
        const { data: padre } = await supabase
          .from("productos")
          .select("precio_venta_contado, precio_venta_credito")
          .eq("id", (producto as Record<string, unknown>).producto_origen_id as string)
          .single()
        if (padre) {
          const pRef = tipoVenta === "contado" ? padre.precio_venta_contado : padre.precio_venta_credito
          setPendingParcial({
            producto,
            preciosPadre: {
              contado: padre.precio_venta_contado,
              credito: padre.precio_venta_credito,
            },
          })
          setPorcentajeParcial(50)
          setPrecioParcial(Math.round(pRef * 0.5 * 100) / 100)
          setErrorParcial("")
        }
        return
      }

      const precioRef =
        tipoVenta === "contado"
          ? producto.precio_venta_contado
          : producto.precio_venta_credito

      const prodAny = producto as Record<string, unknown>
      setDetalles((prev) => [
        ...prev,
        {
          producto_id: producto.id,
          precio_unitario: precioRef,
          cantidad: 1,
          _nombre: producto.nombre,
          _marca: producto.marca,
          _genero: (prodAny.cat_genero as { nombre: string } | null)?.nombre ?? undefined,
          _sku: producto.sku,
          _stock_actual: producto.stock_actual,
          _precio_minimo:
            producto.estado_producto === "segunda" ? 0 : precioRef,
          _estado_producto: producto.estado_producto,
        },
      ])
    },
    [tipoVenta]
  )

  const handleUpdateDetalle = useCallback(
    (index: number, field: string, value: number) => {
      setDetalles((prev) =>
        prev.map((d, i) => {
          if (i !== index) return d
          const updated = { ...d, [field]: value }
          // Recalculate percentage when price changes on a parcial with known padre price
          if (field === "precio_unitario" && (d._estado_producto === "parcial" || d._estado_producto === "segunda") && d._precio_padre && d._precio_padre > 0) {
            updated._porcentaje_parcial = Math.round((value / d._precio_padre) * 100)
          }
          return updated
        })
      )
    },
    []
  )

  const handleRemoveDetalle = useCallback((index: number) => {
    setDetalles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleConfirmParcial = useCallback(() => {
    if (!pendingParcial) return
    const producto = pendingParcial.producto

    // Check stock: count how many of this parcial are already in detalles
    const yaAgregadas = detalles.filter((d) => d.producto_id === producto.id).reduce((sum, d) => sum + d.cantidad, 0)
    if (yaAgregadas >= producto.stock_actual) {
      setErrorParcial("No hay más stock disponible de este producto")
      return
    }

    const precioPadreRef = tipoVenta === "contado"
      ? pendingParcial.preciosPadre.contado
      : pendingParcial.preciosPadre.credito

    const precioFinal = Number(precioParcial)
    if (!precioFinal || precioFinal <= 0) {
      setErrorParcial("El precio debe ser mayor a 0")
      return
    }
    if (precioFinal > precioPadreRef) {
      setErrorParcial(`El precio no puede superar el precio del padre (${formatMoney(precioPadreRef)})`)
      return
    }
    setErrorParcial("")

    const porcentajeCalculado = Math.round((precioFinal / precioPadreRef) * 100)
    const prodAny = producto as Record<string, unknown>

    setDetalles((prev) => [
      ...prev,
      {
        producto_id: producto.id,
        precio_unitario: precioFinal,
        cantidad: 1,
        _nombre: producto.nombre,
        _marca: producto.marca,
        _genero: (prodAny.cat_genero as { nombre: string } | null)?.nombre ?? undefined,
        _sku: producto.sku,
        _stock_actual: producto.stock_actual,
        _precio_minimo: 0,
        _estado_producto: producto.estado_producto,
        _porcentaje_parcial: porcentajeCalculado,
        _precio_padre: precioPadreRef,
      },
    ])
    setPendingParcial(null)
    setPorcentajeParcial(50)
    setPrecioParcial("")
    setErrorParcial("")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingParcial, precioParcial, tipoVenta])

  const pagoMontoActual = tipoVenta === "contado" ? total : pagoMonto

  function validate(): boolean {
    const errs: Record<string, string> = {}

    if (!clienteId) errs.cliente_id = "Selecciona un cliente"
    if (detalles.length === 0) errs.detalles = "Agrega al menos un producto"
    if (!fecha) errs.fecha = "La fecha es requerida"

    const precioInvalido = detalles.some(
      (d) => d._precio_minimo && d.precio_unitario < d._precio_minimo
    )
    if (precioInvalido)
      errs.detalles = "Hay productos con precio menor al mínimo"

    const stockInvalido = detalles.some(
      (d) => d._stock_actual && d.cantidad > d._stock_actual
    )
    if (stockInvalido)
      errs.detalles = "Hay productos con cantidad mayor al stock"

    if (tipoVenta === "contado") {
      if (!pagoTipo) errs.pago_tipo = "Selecciona tipo de pago"
      if (pagoTipo === "transferencia" && !pagoCuenta)
        errs.pago_cuenta = "Selecciona cuenta"
    }

    if (tipoVenta === "credito") {
      if (!lineaActiva) {
        if (!periodicidad) errs.periodicidad = "Selecciona periodicidad"
        if (!fechaPrimerPago)
          errs.fecha_primer_pago = "Fecha del primer pago requerida"
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // Step 1: validate and show confirmation
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !vendedor) return
    setShowConfirm(true)
  }

  // Step 2: actually create the sale
  function handleConfirm() {
    if (!vendedor) return
    setShowConfirm(false)

    create.mutate(
      {
        vendedor_id: vendedor.id,
        cliente_id: clienteId,
        tipo_venta: tipoVenta,
        fecha,
        detalles: detalles.map((d) => ({
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
        })),
        ...(tipoVenta === "contado"
          ? {
              pago: {
                monto: total,
                tipo_pago: pagoTipo,
                cuenta_bancaria_id: pagoCuenta,
              },
            }
          : {
              periodicidad: lineaActiva ? ajustePeriodicidad : periodicidad,
              fecha_primer_pago: lineaActiva ? ajusteFechaPago : fechaPrimerPago,
              entrega_despues_pago: entregaDespuesPago,
              meses_credito: lineaActiva ? ajusteMeses : mesesCredito,
              primer_abono:
                primerAbono && primerAbono.monto > 0 ? primerAbono : null,
              linea_credito_id: lineaActiva?.id,
              ...(lineaActiva ? {
                ajuste_meses_credito: ajusteMeses,
                ajuste_periodicidad: ajustePeriodicidad,
                ajuste_fecha_siguiente_pago: ajusteFechaPago,
              } : {}),
            }),
      },
      {
        onSuccess: (venta) => {
          setVentaCreada({ folio: venta.folio, id: venta.id })
          setShowSuccess(true)
        },
      }
    )
  }

  // PDF generation
  async function handleShareTicket() {
    const blob = await pdf(
      <VentaTicketPDF
        folio={ventaCreada?.folio ?? ""}
        fecha={fecha}
        clienteNombre={clienteNombre}
        clienteTelefono={clienteTelefono}
        vendedorNombre={vendedor?.nombre ?? ""}
        tipoVenta={tipoVenta}
        total={total}
        detalles={detalles.map((d) => ({
          nombre: d._nombre ?? "",
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.cantidad * d.precio_unitario,
          estado_producto: d._estado_producto,
          marca: d._marca,
          genero: d._genero,
          sku: d._sku,
        }))}
        tipoPago={pagoTipo || undefined}
        periodicidad={tipoVenta === "credito" ? periodicidad : undefined}
        fechaPrimerPago={
          tipoVenta === "credito" ? fechaPrimerPago : undefined
        }
        mesesCredito={tipoVenta === "credito" ? mesesCredito : undefined}
      />
    ).toBlob()
    await sharePDF(
      blob,
      `ticket-${ventaCreada?.folio ?? "venta"}.pdf`,
      `Ticket de venta ${ventaCreada?.folio}`
    )
  }

  async function handleDownloadTicket() {
    const blob = await pdf(
      <VentaTicketPDF
        folio={ventaCreada?.folio ?? ""}
        fecha={fecha}
        clienteNombre={clienteNombre}
        clienteTelefono={clienteTelefono}
        vendedorNombre={vendedor?.nombre ?? ""}
        tipoVenta={tipoVenta}
        total={total}
        detalles={detalles.map((d) => ({
          nombre: d._nombre ?? "",
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.cantidad * d.precio_unitario,
          estado_producto: d._estado_producto,
          marca: d._marca,
          genero: d._genero,
          sku: d._sku,
        }))}
        tipoPago={pagoTipo || undefined}
        periodicidad={tipoVenta === "credito" ? periodicidad : undefined}
        fechaPrimerPago={
          tipoVenta === "credito" ? fechaPrimerPago : undefined
        }
        mesesCredito={tipoVenta === "credito" ? mesesCredito : undefined}
      />
    ).toBlob()
    await downloadPDF(blob, `ticket-${ventaCreada?.folio ?? "venta"}.pdf`)
  }

  function buildTablaPagosElement() {
    if (lineaActiva) {
      const saldoAnterior = lineaActiva.saldo_total - lineaActiva.saldo_pagado
      const nuevoSaldo = saldoAnterior + total - (primerAbono?.monto ?? 0)
      return (
        <TablaPagosPDF
          folio={ventaCreada?.folio ?? "PREVIEW"}
          clienteNombre={clienteNombre}
          total={total}
          primerAbono={0}
          saldoProyectado={nuevoSaldo}
          meses={ajusteMeses}
          periodicidad={ajustePeriodicidad}
          fechaPrimerPago={ajusteFechaPago}
          pagosRealizados={[]}
        />
      )
    }
    return (
      <TablaPagosPDF
        folio={ventaCreada?.folio ?? "PREVIEW"}
        clienteNombre={clienteNombre}
        total={total}
        primerAbono={primerAbono?.monto ?? 0}
        meses={mesesCredito}
        periodicidad={periodicidad}
        fechaPrimerPago={fechaPrimerPago}
        pagosRealizados={
          primerAbono && primerAbono.monto > 0
            ? [{ monto: primerAbono.monto, fecha }]
            : []
        }
      />
    )
  }

  async function handleShareTablaPagos() {
    const blob = await pdf(buildTablaPagosElement()).toBlob()
    await sharePDF(
      blob,
      `tabla-pagos-${ventaCreada?.folio ?? "venta"}.pdf`,
      `Tabla de pagos ${ventaCreada?.folio}`
    )
  }

  async function handleDownloadTablaPagos() {
    const blob = await pdf(buildTablaPagosElement()).toBlob()
    await downloadPDF(
      blob,
      `tabla-pagos-${ventaCreada?.folio ?? "venta"}.pdf`
    )
  }

  // --- Resumen reutilizable ---
  function ResumenVenta() {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium">{clienteNombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="font-medium">
              {tipoVenta === "contado" ? "Contado" : "Crédito"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Fecha</p>
            <p className="font-medium">
              {formatDate(fecha)}
            </p>
          </div>
          {tipoVenta === "contado" && pagoTipo && (
            <div>
              <p className="text-muted-foreground">Forma de pago</p>
              <p className="font-medium">
                {TIPO_PAGO_LABELS[pagoTipo] ?? pagoTipo}
                {pagoTipo === "transferencia" && pagoCuentaAlias && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {pagoCuentaAlias}
                  </span>
                )}
              </p>
            </div>
          )}
          {tipoVenta === "credito" && !lineaActiva && (
            <>
              <div>
                <p className="text-muted-foreground">Plazo</p>
                <p className="font-medium">
                  {mesesCredito} {mesesCredito === 1 ? "mes" : "meses"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Periodicidad</p>
                <p className="font-medium capitalize">{periodicidad}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Primer pago</p>
                <p className="font-medium">
                  {fechaPrimerPago
                    ? formatDate(fechaPrimerPago)
                    : "—"}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y">
          {detalles.map((d) => (
            <div key={d.producto_id} className="py-2 border-b last:border-b-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{d._nombre}</span>
                {d._estado_producto && d._estado_producto !== "nuevo" && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0">
                    {d._estado_producto === "parcial" ? `Parcial${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}` : `Segunda${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}`}
                  </Badge>
                )}
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {d.cantidad} &times; {formatMoney(d.precio_unitario)} ={" "}
                <span className="font-medium text-foreground">
                  {formatMoney(d.cantidad * d.precio_unitario)}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Cant.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detalles.map((d) => (
                <TableRow key={d.producto_id}>
                  <TableCell className="text-sm">
                    {d._nombre}
                    {d._estado_producto && d._estado_producto !== "nuevo" && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({d._estado_producto === "parcial" ? `Parcial${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}` : `Segunda${d._porcentaje_parcial ? ` ${d._porcentaje_parcial}%` : ""}`})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatMoney(d.precio_unitario)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {d.cantidad}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatMoney(d.cantidad * d.precio_unitario)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <p className="text-lg font-bold">Total: {formatMoney(total)}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos de la venta */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de la venta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <ClienteAutocomplete
                  value={clienteId}
                  onSelect={setClienteId}
                />
                {errors.cliente_id && (
                  <p className="text-sm text-destructive">
                    {errors.cliente_id}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo de venta *</Label>
                <Select
                  value={tipoVenta}
                  onValueChange={(v) => {
                    const nuevo = v as TipoVenta
                    if (nuevo === tipoVenta) return
                    if (detalles.length > 0) {
                      setPendingTipoVenta(nuevo)
                      return
                    }
                    setTipoVenta(nuevo)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contado">Contado</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha *</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
                {errors.fecha && (
                  <p className="text-sm text-destructive">{errors.fecha}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Productos */}
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProductoSelector
              tipoVenta={tipoVenta}
              onSelect={handleAddProducto}
              excludeIds={detalles.filter((d) => d._estado_producto !== "parcial" && d._estado_producto !== "segunda").map((d) => d.producto_id)}
            />
            {pendingParcial && (
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">Porcentaje del producto {pendingParcial.producto.estado_producto === "parcial" ? "parcial" : "segunda"}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingParcial.producto.nombre} — Precio padre:{" "}
                  <span className="font-mono font-medium text-foreground">
                    {formatMoney(tipoVenta === "contado" ? pendingParcial.preciosPadre.contado : pendingParcial.preciosPadre.credito)}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {[25, 50, 75, 90].map((pct) => {
                    const pRef = tipoVenta === "contado" ? pendingParcial.preciosPadre.contado : pendingParcial.preciosPadre.credito
                    return (
                      <Button
                        key={pct}
                        type="button"
                        variant={porcentajeParcial === pct ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setPorcentajeParcial(pct)
                          setPrecioParcial(Math.round(pRef * (pct / 100) * 100) / 100)
                          setErrorParcial("")
                        }}
                      >
                        {pct}%
                      </Button>
                    )
                  })}
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={porcentajeParcial}
                      onChange={(e) => {
                        const pct = Number(e.target.value)
                        const pRef = tipoVenta === "contado" ? pendingParcial.preciosPadre.contado : pendingParcial.preciosPadre.credito
                        setPorcentajeParcial(pct)
                        if (pct > 0 && pct <= 99) {
                          setPrecioParcial(Math.round(pRef * (pct / 100) * 100) / 100)
                        }
                      }}
                      className="w-16 h-8"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">Precio:</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={precioParcial}
                      onChange={(e) => setPrecioParcial(e.target.value)}
                      onBlur={() => {
                        if (!pendingParcial) return
                        const precio = Number(precioParcial)
                        const pRef = tipoVenta === "contado" ? pendingParcial.preciosPadre.contado : pendingParcial.preciosPadre.credito
                        if (!precio || precio <= 0) {
                          setErrorParcial("El precio debe ser mayor a 0")
                        } else if (precio > pRef) {
                          setErrorParcial(`El precio no puede superar ${formatMoney(pRef)}`)
                        } else {
                          setErrorParcial("")
                          setPorcentajeParcial(Math.round((precio / pRef) * 100))
                        }
                      }}
                      className={`w-28 h-8 font-mono ${errorParcial ? "border-destructive" : ""}`}
                    />
                  </div>
                  {errorParcial && (
                    <p className="text-xs text-destructive">{errorParcial}</p>
                  )}
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => { setPendingParcial(null); setPorcentajeParcial(50); setPrecioParcial(""); setErrorParcial("") }}>
                      Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={handleConfirmParcial}>
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {errors.detalles && (
              <p className="text-sm text-destructive">{errors.detalles}</p>
            )}
            <VentaDetalleTable
              detalles={detalles}
              tipoVenta={tipoVenta}
              onUpdate={handleUpdateDetalle}
              onRemove={handleRemoveDetalle}
            />
          </CardContent>
        </Card>

        {/* Crédito */}
        {tipoVenta === "credito" && (
          <Card>
            <CardHeader>
              <CardTitle>Datos del crédito</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {lineaActiva && (() => {
                const saldoPendiente = lineaActiva.saldo_total - lineaActiva.saldo_pagado
                return (
                  <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/30 p-3 text-sm space-y-1">
                    <p className="font-medium">Este cliente tiene una línea de crédito activa</p>
                    <p className="text-muted-foreground">Saldo actual: <span className="font-mono">{formatMoney(saldoPendiente)}</span></p>
                    <p className="text-muted-foreground">Nuevo saldo proyectado: <span className="font-mono font-medium text-foreground">{formatMoney(saldoPendiente + total)}</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Periodicidad</p>
                        <p className="text-xs font-medium capitalize">{lineaActiva.periodicidad}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Ultimo pago</p>
                        <p className="text-xs font-medium">
                          {ultimoPagoQuery.data
                            ? `${formatDate(ultimoPagoQuery.data.fecha)} — ${formatMoney(ultimoPagoQuery.data.monto)}`
                            : "Sin pagos"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Proximo pago</p>
                        <p className="text-xs font-medium">
                          {lineaActiva.fecha_siguiente_pago
                            ? formatDate(lineaActiva.fecha_siguiente_pago)
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}
              <CreditoFields
                clienteId={clienteId || null}
                mesesCredito={mesesCredito}
                periodicidad={periodicidad}
                fechaPrimerPago={fechaPrimerPago}
                entregaDespuesPago={entregaDespuesPago}
                primerAbono={primerAbono}
                deudaAcumulada={deudaAcumulada}
                hideTerms={!!lineaActiva}
                onMesesCreditoChange={setMesesCredito}
                onPeriodicidadChange={setPeriodicidad}
                onFechaPrimerPagoChange={setFechaPrimerPago}
                onEntregaDespuesPagoChange={setEntregaDespuesPago}
                onPrimerAbonoChange={setPrimerAbono}
                errors={errors}
              />
            </CardContent>
          </Card>
        )}

        {/* Pago contado */}
        {tipoVenta === "contado" && detalles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <PagoForm
                monto={pagoMontoActual}
                tipoPago={pagoTipo}
                cuentaBancariaId={pagoCuenta}
                montoReadOnly
                onMontoChange={setPagoMonto}
                onTipoPagoChange={setPagoTipo}
                onCuentaChange={(id) => {
                  setPagoCuenta(id)
                }}
                onCuentaAliasChange={setPagoCuentaAlias}
                errors={{
                  tipo_pago: errors.pago_tipo,
                  cuenta_bancaria_id: errors.pago_cuenta,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/ventas")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Registrando..." : "Registrar venta"}
          </Button>
        </div>
      </form>

      {/* Dialog: Confirmación */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar venta</AlertDialogTitle>
            <AlertDialogDescription>
              Revisa los datos antes de registrar la venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ResumenVenta />
          {tipoVenta === "credito" && lineaActiva && (() => {
            const saldoAnterior = lineaActiva.saldo_total - lineaActiva.saldo_pagado
            const nuevoSaldoProyectado = saldoAnterior + total - (primerAbono && primerAbono.monto > 0 ? primerAbono.monto : 0)
            return (
              <>
                <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
                  <p className="text-sm font-semibold">Resumen del credito</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo anterior</span>
                      <span className="font-mono tabular-nums">{formatMoney(saldoAnterior)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">+ Nueva compra</span>
                      <span className="font-mono tabular-nums">{formatMoney(total)}</span>
                    </div>
                    {primerAbono && primerAbono.monto > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">- Abono</span>
                        <span className="font-mono tabular-nums text-green-600">{formatMoney(primerAbono.monto)}</span>
                      </div>
                    )}
                    <div className="border-t pt-1 flex justify-between font-bold">
                      <span>Nuevo saldo</span>
                      <span className="font-mono tabular-nums">{formatMoney(nuevoSaldoProyectado)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Ajuste de plan de pagos</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Plazo</Label>
                      <Select value={String(ajusteMeses)} onValueChange={(v) => setAjusteMeses(Number(v))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6].map(m => <SelectItem key={m} value={String(m)}>{m} {m===1?"mes":"meses"}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Periodicidad</Label>
                      <Select value={ajustePeriodicidad} onValueChange={setAjustePeriodicidad}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="quincenal">Quincenal</SelectItem>
                          <SelectItem value="mensual">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sig. pago</Label>
                      <Input type="date" min={today} value={ajusteFechaPago} onChange={e => setAjusteFechaPago(e.target.value)} className="h-8" />
                    </div>
                  </div>
                  {ajusteFechaPago && nuevoSaldoProyectado > 0 && (() => {
                    // Calculate total payments based on periodicidad
                    const periodoDias = ajustePeriodicidad === "semanal" ? 7 : ajustePeriodicidad === "quincenal" ? 14 : 30
                    const totalPagos = Math.max(1, Math.ceil(ajusteMeses * 30 / periodoDias))
                    const cuota = Math.ceil((nuevoSaldoProyectado / totalPagos) * 100) / 100
                    let fecha = new Date(ajusteFechaPago + "T12:00:00")
                    const pagos: { f: string; m: number }[] = []
                    let restante = nuevoSaldoProyectado
                    for (let i = 0; i < totalPagos && restante > 0; i++) {
                      pagos.push({ f: fecha.toLocaleDateString("es-MX"), m: Math.min(cuota, restante) })
                      restante -= cuota
                      // Advance date matching TablaPagosPDF logic
                      if (ajustePeriodicidad === "semanal") {
                        fecha = new Date(fecha.getTime() + 7 * 86400000)
                      } else if (ajustePeriodicidad === "quincenal") {
                        const day = fecha.getDate()
                        if (day <= 15) {
                          // Next: last day of current month
                          fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 12)
                        } else {
                          // Next: 15th of next month
                          fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 15, 12)
                        }
                      } else {
                        // Mensual: last day of next month
                        fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 2, 0, 12)
                      }
                    }
                    return (
                      <div className="rounded-md border bg-muted/30 p-2 max-h-32 overflow-y-auto">
                        <p className="text-xs font-medium mb-1">Calendario ({pagos.length} pagos de {formatMoney(cuota)})</p>
                        {pagos.map((p, i) => (
                          <div key={i} className="flex justify-between text-xs py-0.5">
                            <span className="text-muted-foreground">{p.f}</span>
                            <span className="font-mono tabular-nums">{formatMoney(p.m)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </>
            )
          })()}
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
            {tipoVenta === "credito" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full sm:w-auto"
                  onClick={handleShareTablaPagos}
                >
                  <Share2 className="h-4 w-4" />
                  Compartir tabla de pagos
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 w-full sm:w-auto"
                  onClick={handleDownloadTablaPagos}
                >
                  <Download className="h-4 w-4" />
                  Descargar tabla de pagos
                </Button>
              </>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <AlertDialogCancel className="flex-1 sm:flex-none">Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirm} className="flex-1 sm:flex-none">
                Confirmar venta
              </AlertDialogAction>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Éxito */}
      <AlertDialog open={showSuccess}>
        <AlertDialogContent className="sm:max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <AlertDialogTitle>Venta registrada</AlertDialogTitle>
                <AlertDialogDescription>
                  Folio: {ventaCreada?.folio}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <ResumenVenta />
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleShareTicket}
            >
              <Share2 className="h-4 w-4" />
              Compartir ticket
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadTicket}
            >
              <Download className="h-4 w-4" />
              Descargar ticket
            </Button>
            {tipoVenta === "credito" && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleShareTablaPagos}
                >
                  <Share2 className="h-4 w-4" />
                  Compartir tabla de pagos
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handleDownloadTablaPagos}
                >
                  <Download className="h-4 w-4" />
                  Descargar tabla de pagos
                </Button>
              </>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button variant="outline" onClick={() => router.push("/ventas")} className="flex-1 sm:flex-none">
                Cerrar
              </Button>
              <Button onClick={() => router.push(`/ventas/${ventaCreada?.id}`)} className="flex-1 sm:flex-none">
                Ver detalle
              </Button>
            </div>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!pendingTipoVenta} onOpenChange={(open) => { if (!open) setPendingTipoVenta(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar tipo de venta</AlertDialogTitle>
            <AlertDialogDescription>
              Al cambiar a {pendingTipoVenta === "contado" ? "contado" : "crédito"} se eliminarán los {detalles.length} producto(s) agregados porque los precios de contado y crédito son diferentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setDetalles([])
              setPendingParcial(null)
              setTipoVenta(pendingTipoVenta!)
              setPendingTipoVenta(null)
            }}>
              Cambiar y eliminar productos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
