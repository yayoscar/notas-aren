"use client"

import { useState, useMemo } from "react"
import { type VentaFullDetail } from "@/hooks/useVentas"
import { useDevolucionUnificada } from "@/hooks/useDevolucionUnificada"
import { useVentasCliente } from "@/hooks/useVentas"
import { ProductoSelector } from "@/components/ventas/ProductoSelector"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  estado_devuelto: "nuevo" | "parcial"
  precio_original: number
  precio_depreciado: number
  seleccionado: boolean
}

interface ProductoNuevo {
  producto_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  stock_actual: number
}

type Paso = 1 | 2 | 3 | 4

export function DevolucionUnificadaDialog({
  venta,
  vendedorId,
  open,
  onOpenChange,
}: Props) {
  const mutation = useDevolucionUnificada()
  const { data: ventasCliente } = useVentasCliente(venta.cliente_id)

  // State
  const [paso, setPaso] = useState<Paso>(1)
  const [motivo, setMotivo] = useState("")
  const [esCambio, setEsCambio] = useState(false)
  const [productosNuevos, setProductosNuevos] = useState<ProductoNuevo[]>([])
  const [abonarCredito, setAbonarCredito] = useState(false)
  const [resultadoExitoso, setResultadoExitoso] = useState<{
    tipo: string
    montoDevuelto: number
    montoNuevo: number
    diferencia: number
    montoAbonadoCredito: number
    montoDevueltoEfectivo: number
    creditoAbonadoFolio: string
  } | null>(null)

  // Productos de la venta como devueltos seleccionables
  const [productosDevueltos, setProductosDevueltos] = useState<
    ProductoDevuelto[]
  >(() =>
    (venta.ventas_detalle ?? []).map((d) => ({
      producto_id: d.producto_id,
      nombre: d.productos?.nombre ?? "—",
      cantidad_max: d.cantidad,
      cantidad: d.cantidad,
      estado_devuelto: "nuevo" as const,
      precio_original: d.precio_unitario,
      precio_depreciado: 0,
      seleccionado: false,
    }))
  )

  // Validación de 7 días
  const fechaVenta = new Date(venta.fecha)
  const hoy = new Date()
  const diffDias =
    (hoy.getTime() - fechaVenta.getTime()) / (1000 * 60 * 60 * 24)
  const dentroDelPlazo = diffDias <= 7

  // Cálculos
  const productosSeleccionados = productosDevueltos.filter(
    (p) => p.seleccionado
  )

  const montoDevuelto = useMemo(
    () =>
      productosSeleccionados.reduce((sum, p) => {
        const valor =
          p.estado_devuelto === "parcial" && p.precio_depreciado > 0
            ? p.precio_depreciado * p.cantidad
            : p.precio_original * p.cantidad
        return sum + valor
      }, 0),
    [productosSeleccionados]
  )

  const montoNuevo = useMemo(
    () =>
      productosNuevos.reduce(
        (sum, p) => sum + p.precio_unitario * p.cantidad,
        0
      ),
    [productosNuevos]
  )

  const diferencia = montoDevuelto - montoNuevo

  // Detectar si es anulación (todos los productos, enteros, cantidades completas)
  const esAnulacion = useMemo(() => {
    if (productosSeleccionados.length !== (venta.ventas_detalle ?? []).length)
      return false
    if (productosNuevos.length > 0) return false
    return productosSeleccionados.every(
      (p) =>
        p.estado_devuelto === "nuevo" &&
        p.cantidad >= p.cantidad_max
    )
  }, [productosSeleccionados, productosNuevos, venta.ventas_detalle])

  // Crédito pendiente del cliente
  const creditoPendiente = useMemo(() => {
    if (!ventasCliente) return null
    return ventasCliente.find(
      (v) =>
        v.id !== venta.id &&
        v.tipo_venta === "credito" &&
        v.estado_credito === "activo" &&
        v.saldo_restante > 0
    )
  }, [ventasCliente, venta.id])

  const tipoVentaOriginal = venta.tipo_venta as "contado" | "credito"

  function handleSeleccionarTodos() {
    setProductosDevueltos((prev) =>
      prev.map((p) => ({
        ...p,
        seleccionado: true,
        cantidad: p.cantidad_max,
        estado_devuelto: "nuevo",
      }))
    )
  }

  function handleDeseleccionarTodos() {
    setProductosDevueltos((prev) =>
      prev.map((p) => ({ ...p, seleccionado: false }))
    )
  }

  function updateProductoDevuelto(
    index: number,
    field: Partial<ProductoDevuelto>
  ) {
    setProductosDevueltos((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...field } : p))
    )
  }

  function handleAgregarProductoNuevo(producto: {
    id: string
    nombre: string
    stock_actual: number
    precio_venta_contado: number
    precio_venta_credito: number
  }) {
    const precio =
      tipoVentaOriginal === "contado"
        ? producto.precio_venta_contado
        : producto.precio_venta_credito

    setProductosNuevos((prev) => [
      ...prev,
      {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        precio_unitario: precio,
        stock_actual: producto.stock_actual,
      },
    ])
  }

  function handleRemoverProductoNuevo(index: number) {
    setProductosNuevos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleConfirmar() {
    mutation.mutate(
      {
        venta_id: venta.id,
        tipo: esAnulacion
          ? "anulacion"
          : esCambio
            ? "cambio"
            : "devolucion",
        vendedor_id: vendedorId,
        cliente_id: venta.cliente_id,
        fecha: new Date().toISOString().split("T")[0],
        motivo,
        productos_devueltos: productosSeleccionados.map((p) => ({
          producto_id: p.producto_id,
          cantidad: p.cantidad,
          estado_devuelto: p.estado_devuelto,
          precio_original: p.precio_original,
          precio_depreciado:
            p.estado_devuelto === "parcial" ? p.precio_depreciado : undefined,
        })),
        productos_nuevos: esCambio
          ? productosNuevos.map((p) => ({
              producto_id: p.producto_id,
              cantidad: p.cantidad,
              precio_unitario: p.precio_unitario,
            }))
          : undefined,
        destino_monto: diferencia > 0 ? (abonarCredito ? "abono_credito" : "efectivo") : null,
        tipo_venta_original: tipoVentaOriginal,
      },
      {
        onSuccess: (data) => {
          setResultadoExitoso(data)
        },
      }
    )
  }

  async function handleSharePDF() {
    if (!resultadoExitoso) return
    const element = buildPDFElement()
    const blob = await pdf(element).toBlob()
    await sharePDF(blob, `devolucion-${venta.folio}.pdf`, `Devolución ${venta.folio}`)
  }

  async function handleDownloadPDF() {
    if (!resultadoExitoso) return
    const element = buildPDFElement()
    const blob = await pdf(element).toBlob()
    await downloadPDF(blob, `devolucion-${venta.folio}.pdf`)
  }

  function buildPDFElement() {
    const tipoLabel = esAnulacion
      ? "anulacion"
      : esCambio
        ? "cambio"
        : "devolucion"

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
          precioUnitario:
            p.estado_devuelto === "parcial" ? p.precio_depreciado : p.precio_original,
          subtotal:
            (p.estado_devuelto === "parcial" ? p.precio_depreciado : p.precio_original) *
            p.cantidad,
        }))}
        productosNuevos={
          esCambio
            ? productosNuevos.map((p) => ({
                nombre: p.nombre,
                cantidad: p.cantidad,
                precioUnitario: p.precio_unitario,
                subtotal: p.precio_unitario * p.cantidad,
              }))
            : undefined
        }
        montoDevuelto={montoDevuelto}
        montoNuevo={esCambio ? montoNuevo : undefined}
        diferencia={diferencia}
        resolucion={{
          abonoCredito: resultadoExitoso?.montoAbonadoCredito
            ? { monto: resultadoExitoso.montoAbonadoCredito, creditoRef: resultadoExitoso.creditoAbonadoFolio }
            : undefined,
          reembolsoEfectivo: resultadoExitoso?.montoDevueltoEfectivo || undefined,
        }}
        motivo={motivo}
      />
    )
  }

  function handleCerrar() {
    setPaso(1)
    setMotivo("")
    setEsCambio(false)
    setProductosNuevos([])
    setAbonarCredito(false)
    setResultadoExitoso(null)
    setProductosDevueltos(
      (venta.ventas_detalle ?? []).map((d) => ({
        producto_id: d.producto_id,
        nombre: d.productos?.nombre ?? "—",
        cantidad_max: d.cantidad,
        cantidad: d.cantidad,
        estado_devuelto: "nuevo" as const,
        precio_original: d.precio_unitario,
        precio_depreciado: 0,
        seleccionado: false,
      }))
    )
    onOpenChange(false)
  }

  // Resultado exitoso — pantalla de PDF
  if (resultadoExitoso) {
    return (
      <Dialog open={open} onOpenChange={handleCerrar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Operación completada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-green-50 border border-green-200 p-4 text-center dark:bg-green-950 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200 font-medium">
                {resultadoExitoso.tipo === "anulacion"
                  ? "Venta anulada exitosamente"
                  : resultadoExitoso.tipo === "cambio"
                    ? "Cambio registrado exitosamente"
                    : "Devolución registrada exitosamente"}
              </p>
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
          <DialogTitle>
            Devolución / Cambio — {venta.folio}
          </DialogTitle>
        </DialogHeader>

        {!dentroDelPlazo && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Fuera del plazo de 7 días. No se puede procesar.
          </div>
        )}

        {dentroDelPlazo && (
          <div className="space-y-4">
            {/* Progress indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {[1, 2, 3, 4].map((p) => (
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
                  {p < 4 && <div className="w-8 h-px bg-border" />}
                </div>
              ))}
            </div>

            {/* PASO 1: Selección de productos */}
            {paso === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Productos a devolver</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSeleccionarTodos}
                    >
                      Seleccionar todos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeseleccionarTodos}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right w-20">Cant.</TableHead>
                      <TableHead className="w-28">Estado</TableHead>
                      <TableHead className="text-right w-32">Precio</TableHead>
                      <TableHead className="text-right w-28">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productosDevueltos.map((p, i) => {
                      const subtotal =
                        p.estado_devuelto === "parcial" && p.precio_depreciado > 0
                          ? p.precio_depreciado * p.cantidad
                          : p.precio_original * p.cantidad

                      return (
                        <TableRow key={p.producto_id}>
                          <TableCell>
                            <Checkbox
                              checked={p.seleccionado}
                              onCheckedChange={(checked) =>
                                updateProductoDevuelto(i, {
                                  seleccionado: !!checked,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {p.nombre}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={1}
                              max={p.cantidad_max}
                              value={p.cantidad}
                              onChange={(e) =>
                                updateProductoDevuelto(i, {
                                  cantidad: Math.min(
                                    Number(e.target.value),
                                    p.cantidad_max
                                  ),
                                })
                              }
                              className="w-16 text-right h-8"
                              disabled={!p.seleccionado}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={p.estado_devuelto}
                              onValueChange={(v) =>
                                updateProductoDevuelto(i, {
                                  estado_devuelto: v as "nuevo" | "parcial",
                                })
                              }
                              disabled={!p.seleccionado}
                            >
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="nuevo">Entero</SelectItem>
                                <SelectItem value="parcial">Parcial</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.estado_devuelto === "parcial" && p.seleccionado ? (
                              <Input
                                type="number"
                                min={0}
                                max={p.precio_original}
                                step={0.01}
                                value={p.precio_depreciado || ""}
                                onChange={(e) =>
                                  updateProductoDevuelto(i, {
                                    precio_depreciado: Number(e.target.value),
                                  })
                                }
                                placeholder="Precio"
                                className="w-28 text-right h-8"
                              />
                            ) : (
                              formatMoney(p.precio_original)
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {p.seleccionado ? formatMoney(subtotal) : "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    {productosSeleccionados.length} producto(s) seleccionado(s)
                  </p>
                  <p className="font-medium">
                    Total: {formatMoney(montoDevuelto)}
                  </p>
                </div>

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

            {/* PASO 2: ¿Es cambio? */}
            {paso === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="es-cambio"
                    checked={esCambio}
                    onCheckedChange={(checked) => {
                      setEsCambio(!!checked)
                      if (!checked) setProductosNuevos([])
                    }}
                  />
                  <Label htmlFor="es-cambio" className="font-medium">
                    El cliente desea llevar productos a cambio
                  </Label>
                </div>

                {esCambio && (
                  <div className="space-y-3">
                    <ProductoSelector
                      tipoVenta={tipoVentaOriginal}
                      onSelect={handleAgregarProductoNuevo}
                      excludeIds={productosNuevos.map((p) => p.producto_id)}
                    />

                    {productosNuevos.length > 0 && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead className="text-right w-20">Cant.</TableHead>
                            <TableHead className="text-right w-28">Precio</TableHead>
                            <TableHead className="text-right w-28">Subtotal</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productosNuevos.map((p, i) => (
                            <TableRow key={p.producto_id}>
                              <TableCell className="font-medium">
                                {p.nombre}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min={1}
                                  max={p.stock_actual}
                                  value={p.cantidad}
                                  onChange={(e) => {
                                    const val = Math.min(
                                      Number(e.target.value),
                                      p.stock_actual
                                    )
                                    setProductosNuevos((prev) =>
                                      prev.map((pn, idx) =>
                                        idx === i
                                          ? { ...pn, cantidad: val }
                                          : pn
                                      )
                                    )
                                  }}
                                  className="w-16 text-right h-8"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                {formatMoney(p.precio_unitario)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatMoney(p.precio_unitario * p.cantidad)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoverProductoNuevo(i)}
                                  className="text-destructive h-8 w-8 p-0"
                                >
                                  ×
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Resumen de montos */}
                <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Monto devuelto:</span>
                    <span className="font-medium">
                      {formatMoney(montoDevuelto)}
                    </span>
                  </div>
                  {esCambio && (
                    <>
                      <div className="flex justify-between">
                        <span>Productos nuevos:</span>
                        <span className="font-medium">
                          {formatMoney(montoNuevo)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t pt-1 mt-1">
                        <span className="font-medium">Diferencia:</span>
                        <span
                          className={`font-bold ${
                            diferencia > 0
                              ? "text-green-600"
                              : diferencia < 0
                                ? "text-destructive"
                                : ""
                          }`}
                        >
                          {formatMoney(diferencia)}
                        </span>
                      </div>
                      {diferencia < 0 && (
                        <p className="text-amber-600 text-xs mt-1">
                          El cliente debe pagar {formatMoney(Math.abs(diferencia))}
                        </p>
                      )}
                      {diferencia === 0 && (
                        <p className="text-muted-foreground text-xs mt-1">
                          Intercambio sin diferencia
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setPaso(1)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                  <Button
                    onClick={() => {
                      if (diferencia > 0 || (!esCambio && montoDevuelto > 0)) {
                        setPaso(3)
                      } else {
                        setPaso(4)
                      }
                    }}
                    className="gap-2"
                    disabled={esCambio && productosNuevos.length === 0}
                  >
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* PASO 3: Resolución del monto */}
            {paso === 3 && (
              <div className="space-y-4">
                <h3 className="font-medium">Resolución del monto</h3>

                <div className="rounded-md bg-muted p-3 text-center">
                  <p className="text-sm text-muted-foreground">Monto a resolver</p>
                  <p className="text-2xl font-bold">{formatMoney(diferencia > 0 ? diferencia : montoDevuelto)}</p>
                </div>

                {tipoVentaOriginal === "credito" && (
                  <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
                    El monto se ajustará directamente sobre el crédito de esta venta.
                    {(() => {
                      const pagos = (venta.pagos ?? []).reduce((s, p) => s + p.monto, 0)
                      const montoRes = diferencia > 0 ? diferencia : montoDevuelto
                      const nuevoTotal = venta.total - montoRes
                      if (pagos > nuevoTotal) {
                        return ` Los abonos ya realizados (${formatMoney(pagos)}) superan el nuevo total (${formatMoney(nuevoTotal)}). El excedente de ${formatMoney(pagos - nuevoTotal)} se resolverá a continuación.`
                      }
                      return ""
                    })()}
                  </div>
                )}

                {creditoPendiente && (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="abonar-credito"
                        checked={abonarCredito}
                        onCheckedChange={(checked) => setAbonarCredito(!!checked)}
                      />
                      <Label htmlFor="abonar-credito">
                        Abonar al crédito pendiente — Folio{" "}
                        <strong>{creditoPendiente.folio}</strong>
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-7">
                      Saldo pendiente: {formatMoney(creditoPendiente.saldo_restante)}.
                      {(() => {
                        const montoRes = diferencia > 0 ? diferencia : montoDevuelto
                        if (montoRes > creditoPendiente.saldo_restante) {
                          return ` Se abonarán ${formatMoney(creditoPendiente.saldo_restante)} y la diferencia de ${formatMoney(montoRes - creditoPendiente.saldo_restante)} se devuelve en efectivo.`
                        }
                        return ""
                      })()}
                    </p>
                  </div>
                )}

                {!creditoPendiente && tipoVentaOriginal !== "credito" && (
                  <div className="rounded-md border p-3 text-sm">
                    El cliente no tiene créditos pendientes. El monto se devolverá en <strong>efectivo</strong>.
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setPaso(2)}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                  <Button onClick={() => setPaso(4)} className="gap-2">
                    Siguiente
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* PASO 4: Confirmación */}
            {paso === 4 && (
              <div className="space-y-4">
                <h3 className="font-medium">Confirmar operación</h3>

                {esAnulacion && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Esta acción anulará la venta completa.
                  </div>
                )}

                {/* Resumen */}
                <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                  <p>
                    <strong>Tipo:</strong>{" "}
                    <Badge variant={esAnulacion ? "destructive" : "secondary"}>
                      {esAnulacion
                        ? "Anulación"
                        : esCambio
                          ? "Cambio"
                          : "Devolución"}
                    </Badge>
                  </p>
                  <p>
                    <strong>Productos devueltos:</strong>{" "}
                    {productosSeleccionados.length}
                  </p>
                  {esCambio && (
                    <p>
                      <strong>Productos nuevos:</strong>{" "}
                      {productosNuevos.length}
                    </p>
                  )}
                  <p>
                    <strong>Monto devuelto:</strong>{" "}
                    {formatMoney(montoDevuelto)}
                  </p>
                  {esCambio && (
                    <>
                      <p>
                        <strong>Monto nuevo:</strong>{" "}
                        {formatMoney(montoNuevo)}
                      </p>
                      <p>
                        <strong>Diferencia:</strong>{" "}
                        {formatMoney(diferencia)}
                      </p>
                    </>
                  )}
                  {diferencia > 0 && (
                    <p>
                      <strong>Resolución:</strong>{" "}
                      {tipoVentaOriginal === "credito"
                        ? "Ajuste sobre el crédito"
                        : abonarCredito
                          ? `Abonar al crédito ${creditoPendiente?.folio ?? ""}`
                          : "Devolución en efectivo"}
                      {" — "}
                      {formatMoney(diferencia)}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="motivo-confirmacion">
                    Motivo / Razón *
                  </Label>
                  <Textarea
                    id="motivo-confirmacion"
                    placeholder="Describe el motivo de la operación..."
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

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (diferencia > 0 || (!esCambio && montoDevuelto > 0)) {
                        setPaso(3)
                      } else {
                        setPaso(2)
                      }
                    }}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Atrás
                  </Button>
                  <Button
                    variant={esAnulacion ? "destructive" : "default"}
                    onClick={handleConfirmar}
                    disabled={mutation.isPending || motivo.length < 10}
                  >
                    {mutation.isPending
                      ? "Procesando..."
                      : esAnulacion
                        ? "Confirmar Anulación"
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
