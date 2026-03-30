"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { entradaSchema, type EntradaFormValues } from "@/lib/validations/entrada.schema"
import { useEntradas } from "@/hooks/useEntradas"
import { useProductos } from "@/hooks/useProductos"
import { useProveedores } from "@/hooks/useProveedores"
import { useCrearPrecio } from "@/hooks/usePreciosHistorico"
import { PrecioChangeDialog } from "@/components/inventario/PrecioChangeDialog"
import type { Producto } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Trash2, Search } from "lucide-react"
import { formatMoney } from "@/lib/utils"

interface DetalleRow {
  producto_id: string
  producto_nombre: string
  cantidad: number
  precio_unitario: number
  precio_venta_contado: number
  precio_venta_credito: number
}

interface PrecioDialogItem {
  producto_id: string
  producto_nombre: string
  precioActual: { precio_compra: number; precio_venta_contado: number; precio_venta_credito: number }
  precioNuevo: { precio_compra: number; precio_venta_contado: number; precio_venta_credito: number }
}

export default function NuevaEntradaPage() {
  const router = useRouter()
  const { create } = useEntradas()
  const productos = useProductos()
  const proveedores = useProveedores()
  const crearPrecio = useCrearPrecio()

  const [detalles, setDetalles] = useState<DetalleRow[]>([])
  const [searchProducto, setSearchProducto] = useState("")
  const [showSearch, setShowSearch] = useState(false)

  // Price change dialog state
  const [precioDialogQueue, setPrecioDialogQueue] = useState<PrecioDialogItem[]>([])
  const [currentDialogIndex, setCurrentDialogIndex] = useState(0)
  const [pendingEntrada, setPendingEntrada] = useState<Omit<EntradaFormValues, "detalles"> | null>(null)
  const [priceDecisions, setPriceDecisions] = useState<Map<string, boolean>>(new Map())

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Omit<EntradaFormValues, "detalles">>({
    resolver: zodResolver(entradaSchema.omit({ detalles: true })),
    defaultValues: {
      proveedor_id: "",
      fecha: new Date().toISOString().split("T")[0],
      fecha_factura: "",
      numero_factura: "",
      notas: "",
    },
  })

  const total = useMemo(
    () => detalles.reduce((sum, d) => sum + d.cantidad * d.precio_unitario, 0),
    [detalles]
  )

  const filteredProductos = useMemo((): Producto[] => {
    if (!productos.query.data || !searchProducto) return []
    const s = searchProducto.toLowerCase()
    return (productos.query.data as Producto[])
      .filter(
        (p) =>
          p.activo &&
          (p.nombre.toLowerCase().includes(s) || p.sku?.toLowerCase().includes(s))
      )
      .slice(0, 10)
  }, [productos.query.data, searchProducto])

  function addProducto(producto: {
    id: string
    nombre: string
    sku: string | null
    precio_compra: number
    precio_venta_contado: number
    precio_venta_credito: number
  }) {
    if (detalles.some((d) => d.producto_id === producto.id)) return
    setDetalles([
      ...detalles,
      {
        producto_id: producto.id,
        producto_nombre: `${producto.sku ?? ""} — ${producto.nombre}`,
        cantidad: 1,
        precio_unitario: Number(producto.precio_compra),
        precio_venta_contado: Number(producto.precio_venta_contado),
        precio_venta_credito: Number(producto.precio_venta_credito),
      },
    ])
    setSearchProducto("")
    setShowSearch(false)
  }

  function updateDetalle(
    index: number,
    field: "cantidad" | "precio_unitario" | "precio_venta_contado" | "precio_venta_credito",
    value: number
  ) {
    const updated = [...detalles]
    updated[index] = { ...updated[index], [field]: value }
    setDetalles(updated)
  }

  function removeDetalle(index: number) {
    setDetalles(detalles.filter((_, i) => i !== index))
  }

  // Check prices for all products and build dialog queue
  const checkPricesAndSubmit = useCallback(
    async (values: Omit<EntradaFormValues, "detalles">) => {
      if (detalles.length === 0) return

      // For each product, check if prices differ from active
      const queue: PrecioDialogItem[] = []

      for (const d of detalles) {
        // Find the product data to get current prices from cache
        const prod = (productos.query.data as Producto[] | undefined)?.find(
          (p) => p.id === d.producto_id
        )
        if (!prod) continue

        const precioActual = {
          precio_compra: Number(prod.precio_compra),
          precio_venta_contado: Number(prod.precio_venta_contado),
          precio_venta_credito: Number(prod.precio_venta_credito),
        }
        const precioNuevo = {
          precio_compra: d.precio_unitario,
          precio_venta_contado: d.precio_venta_contado,
          precio_venta_credito: d.precio_venta_credito,
        }

        const changed =
          precioActual.precio_compra !== precioNuevo.precio_compra ||
          precioActual.precio_venta_contado !== precioNuevo.precio_venta_contado ||
          precioActual.precio_venta_credito !== precioNuevo.precio_venta_credito

        if (changed) {
          queue.push({
            producto_id: d.producto_id,
            producto_nombre: d.producto_nombre,
            precioActual,
            precioNuevo,
          })
        }
      }

      if (queue.length === 0) {
        // No price changes — submit directly
        submitEntrada(values, new Map())
      } else {
        // Show price dialogs
        setPrecioDialogQueue(queue)
        setCurrentDialogIndex(0)
        setPendingEntrada(values)
        setPriceDecisions(new Map())
      }
    },
    [detalles, productos.query.data]
  )

  function handlePriceConfirm() {
    const item = precioDialogQueue[currentDialogIndex]
    const newDecisions = new Map(priceDecisions)
    newDecisions.set(item.producto_id, true)
    setPriceDecisions(newDecisions)

    if (currentDialogIndex < precioDialogQueue.length - 1) {
      setCurrentDialogIndex(currentDialogIndex + 1)
    } else {
      // All dialogs processed
      if (pendingEntrada) {
        submitEntrada(pendingEntrada, newDecisions)
      }
      setPrecioDialogQueue([])
    }
  }

  function handlePriceCancel() {
    const item = precioDialogQueue[currentDialogIndex]
    const newDecisions = new Map(priceDecisions)
    newDecisions.set(item.producto_id, false)
    setPriceDecisions(newDecisions)

    if (currentDialogIndex < precioDialogQueue.length - 1) {
      setCurrentDialogIndex(currentDialogIndex + 1)
    } else {
      // All dialogs processed
      if (pendingEntrada) {
        submitEntrada(pendingEntrada, newDecisions)
      }
      setPrecioDialogQueue([])
    }
  }

  async function submitEntrada(
    values: Omit<EntradaFormValues, "detalles">,
    decisions: Map<string, boolean>
  ) {
    // Update prices for confirmed products
    const entries = Array.from(decisions.entries())
    for (const [productoId, shouldUpdate] of entries) {
      if (!shouldUpdate) continue
      const detalle = detalles.find((d) => d.producto_id === productoId)
      if (!detalle) continue
      await crearPrecio.mutateAsync({
        producto_id: productoId,
        precio_compra: detalle.precio_unitario,
        precio_venta_contado: detalle.precio_venta_contado,
        precio_venta_credito: detalle.precio_venta_credito,
        origen: "entrada",
      })
    }

    // Create the entrada
    create.mutate(
      {
        ...values,
        fecha_factura: values.fecha_factura || null,
        numero_factura: values.numero_factura || null,
        notas: values.notas || null,
        detalles: detalles.map((d) => ({
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          precio_venta_contado: d.precio_venta_contado,
          precio_venta_credito: d.precio_venta_credito,
        })),
      },
      { onSuccess: () => router.push("/entradas") }
    )

    setPendingEntrada(null)
  }

  const currentDialogItem = precioDialogQueue[currentDialogIndex] ?? null
  const isSaving = create.isPending || crearPrecio.isPending

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Nueva entrada de inventario</h1>

      <form onSubmit={handleSubmit(checkPricesAndSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos de la entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="proveedor_id">Proveedor *</Label>
                <select
                  id="proveedor_id"
                  {...register("proveedor_id")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">— Seleccionar —</option>
                  {proveedores.query.data?.filter(p => p.activo).map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
                {errors.proveedor_id && <p className="text-sm text-destructive">{errors.proveedor_id.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input id="fecha" type="date" {...register("fecha")} />
                {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_factura">Fecha factura</Label>
                <Input id="fecha_factura" type="date" {...register("fecha_factura")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_factura">N° Factura</Label>
                <Input id="numero_factura" {...register("numero_factura")} placeholder="FAC-001" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea id="notas" {...register("notas")} placeholder="Notas adicionales" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle de productos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto por nombre o SKU..."
                  value={searchProducto}
                  onChange={(e) => {
                    setSearchProducto(e.target.value)
                    setShowSearch(true)
                  }}
                  onFocus={() => setShowSearch(true)}
                  className="pl-10"
                />
              </div>
              {showSearch && filteredProductos.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg">
                  {filteredProductos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-accent"
                      onClick={() => addProducto(p)}
                    >
                      <span>
                        <span className="font-mono text-muted-foreground">{p.sku}</span>{" "}
                        {p.nombre}
                      </span>
                      <span className="text-muted-foreground">{formatMoney(Number(p.precio_compra))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {detalles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Busca y agrega productos arriba
                </p>
              )}
              {detalles.map((d, i) => (
                <div key={d.producto_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate mr-2">{d.producto_nombre}</span>
                    <Button size="sm" variant="ghost" type="button" className="text-destructive shrink-0" onClick={() => removeDetalle(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Cantidad</label>
                      <Input
                        type="number"
                        min={1}
                        value={d.cantidad}
                        onChange={(e) => updateDetalle(i, "cantidad", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">P. Compra</label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.precio_unitario}
                        onChange={(e) => updateDetalle(i, "precio_unitario", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">P. Contado</label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.precio_venta_contado}
                        onChange={(e) => updateDetalle(i, "precio_venta_contado", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">P. Credito</label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.precio_venta_credito}
                        onChange={(e) => updateDetalle(i, "precio_venta_credito", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium">Subtotal: {formatMoney(d.cantidad * d.precio_unitario)}</span>
                  </div>
                </div>
              ))}
              {detalles.length > 0 && (
                <div className="text-right pt-2 border-t">
                  <span className="font-bold">Total: </span>
                  <span className="font-bold font-mono">{formatMoney(total)}</span>
                </div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-24">Cantidad</TableHead>
                    <TableHead className="w-32">P. Compra</TableHead>
                    <TableHead className="hidden sm:table-cell w-32">P. Contado</TableHead>
                    <TableHead className="hidden sm:table-cell w-32">P. Crédito</TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Busca y agrega productos arriba
                      </TableCell>
                    </TableRow>
                  )}
                  {detalles.map((d, i) => (
                    <TableRow key={d.producto_id}>
                      <TableCell className="max-w-[200px] truncate">{d.producto_nombre}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          value={d.cantidad}
                          onChange={(e) => updateDetalle(i, "cantidad", parseInt(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={d.precio_unitario}
                          onChange={(e) => updateDetalle(i, "precio_unitario", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={d.precio_venta_contado}
                          onChange={(e) => updateDetalle(i, "precio_venta_contado", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={d.precio_venta_credito}
                          onChange={(e) => updateDetalle(i, "precio_venta_credito", parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(d.cantidad * d.precio_unitario)}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" type="button" onClick={() => removeDetalle(i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {detalles.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-right font-bold">
                        Total:
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatMoney(total)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {detalles.length === 0 && (
              <p className="mt-2 text-sm text-destructive">Agrega al menos un producto</p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => router.push("/entradas")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving || detalles.length === 0}>
            {isSaving ? "Guardando..." : "Registrar entrada"}
          </Button>
        </div>
      </form>

      {currentDialogItem && (
        <PrecioChangeDialog
          open={precioDialogQueue.length > 0}
          onOpenChange={() => {}}
          precioActual={currentDialogItem.precioActual}
          precioNuevo={currentDialogItem.precioNuevo}
          onConfirm={handlePriceConfirm}
          onCancel={handlePriceCancel}
          isPending={crearPrecio.isPending}
        />
      )}
    </div>
  )
}
