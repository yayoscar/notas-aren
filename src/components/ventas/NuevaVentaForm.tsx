"use client"

import { useState, useCallback } from "react"
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
import { useCreditosCliente } from "@/hooks/usePagos"
import { sharePDF, downloadPDF } from "@/lib/pdf-utils"
import { formatMoney } from "@/lib/utils"
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

  const today = new Date().toISOString().split("T")[0]

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

  // Deuda acumulada del cliente
  const { data: creditosCliente } = useCreditosCliente(clienteId || "")
  const deudaAcumulada = (creditosCliente ?? []).reduce(
    (sum, c) => sum + c.saldo_restante,
    0
  )

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
    (producto: Producto) => {
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
            producto.estado_producto === "parcial" ? 0 : precioRef,
          _estado_producto: producto.estado_producto,
        },
      ])
    },
    [tipoVenta]
  )

  const handleUpdateDetalle = useCallback(
    (index: number, field: string, value: number) => {
      setDetalles((prev) =>
        prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
      )
    },
    []
  )

  const handleRemoveDetalle = useCallback((index: number) => {
    setDetalles((prev) => prev.filter((_, i) => i !== index))
  }, [])

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
      if (!periodicidad) errs.periodicidad = "Selecciona periodicidad"
      if (!fechaPrimerPago)
        errs.fecha_primer_pago = "Fecha del primer pago requerida"
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
              periodicidad,
              fecha_primer_pago: fechaPrimerPago,
              entrega_despues_pago: entregaDespuesPago,
              meses_credito: mesesCredito,
              primer_abono:
                primerAbono && primerAbono.monto > 0 ? primerAbono : null,
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
              {new Date(fecha).toLocaleDateString("es-MX")}
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
          {tipoVenta === "credito" && (
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
                    ? new Date(fechaPrimerPago).toLocaleDateString("es-MX")
                    : "—"}
                </p>
              </div>
            </>
          )}
        </div>

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
                      ({d._estado_producto === "tester" ? "Tester" : "Parcial"})
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
                  onValueChange={(v) => setTipoVenta(v as TipoVenta)}
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
              excludeIds={detalles.map((d) => d.producto_id)}
            />
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
            <CardContent>
              <CreditoFields
                clienteId={clienteId || null}
                mesesCredito={mesesCredito}
                periodicidad={periodicidad}
                fechaPrimerPago={fechaPrimerPago}
                entregaDespuesPago={entregaDespuesPago}
                primerAbono={primerAbono}
                deudaAcumulada={deudaAcumulada}
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
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar venta</AlertDialogTitle>
            <AlertDialogDescription>
              Revisa los datos antes de registrar la venta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ResumenVenta />
          {tipoVenta === "credito" && (
            <div className="flex gap-2 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleShareTablaPagos}
              >
                <Share2 className="h-4 w-4" />
                Compartir tabla de pagos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleDownloadTablaPagos}
              >
                <Download className="h-4 w-4" />
                Descargar tabla de pagos
              </Button>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Confirmar venta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Éxito */}
      <AlertDialog open={showSuccess}>
        <AlertDialogContent className="max-w-lg">
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
            <Button onClick={() => router.push(`/ventas/${ventaCreada?.id}`)}>
              Ver detalle
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
