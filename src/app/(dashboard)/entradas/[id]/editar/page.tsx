"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  entradaEditSchema,
  type EntradaEditFormValues,
} from "@/lib/validations/entrada.schema"
import { useEntrada, useEntradas } from "@/hooks/useEntradas"
import { useProductos, type ProductoWithRelations } from "@/hooks/useProductos"
import { useProveedores } from "@/hooks/useProveedores"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Trash2, Search } from "lucide-react"
import { formatMoney } from "@/lib/utils"

type CabeceraValues = Omit<EntradaEditFormValues, "detalles">

interface DetalleRow {
  producto_id: string
  producto_nombre: string
  cantidad: number | ""
  precio_unitario: number | ""
}

export default function EditarEntradaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: entrada, isLoading } = useEntrada(id)
  const { update } = useEntradas()
  const productos = useProductos()
  const proveedores = useProveedores()

  const [detalles, setDetalles] = useState<DetalleRow[]>([])
  const [searchProducto, setSearchProducto] = useState("")
  const [showSearch, setShowSearch] = useState(false)
  const [errores, setErrores] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CabeceraValues>({
    resolver: zodResolver(entradaEditSchema.omit({ detalles: true })),
    defaultValues: {
      proveedor_id: "",
      fecha: "",
      fecha_factura: "",
      numero_factura: "",
      notas: "",
    },
  })

  // Sembrar el formulario y las líneas en cuanto llega la entrada.
  useEffect(() => {
    if (!entrada) return
    reset({
      proveedor_id: entrada.proveedor_id,
      fecha: entrada.fecha.slice(0, 10),
      fecha_factura: entrada.fecha_factura?.slice(0, 10) ?? "",
      numero_factura: entrada.numero_factura ?? "",
      notas: entrada.notas ?? "",
    })
    setDetalles(
      (entrada.entradas_detalle ?? []).map((d) => ({
        producto_id: d.producto_id,
        producto_nombre: `${d.productos?.sku ?? ""} — ${d.productos?.nombre ?? "—"}`,
        cantidad: d.cantidad,
        precio_unitario: Number(d.precio_unitario),
      }))
    )
  }, [entrada, reset])

  const total = useMemo(
    () =>
      detalles.reduce(
        (sum, d) =>
          sum + (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0),
        0
      ),
    [detalles]
  )

  const filteredProductos = useMemo((): ProductoWithRelations[] => {
    if (!productos.query.data || !searchProducto) return []
    const s = searchProducto.toLowerCase()
    return (productos.query.data as ProductoWithRelations[])
      .filter(
        (p) =>
          p.activo &&
          // Igual que en el alta: las entradas sólo aplican a producto completo.
          p.estado_producto === "nuevo" &&
          (p.nombre.toLowerCase().includes(s) ||
            p.sku?.toLowerCase().includes(s) ||
            p.marca.toLowerCase().includes(s))
      )
      .slice(0, 10)
  }, [productos.query.data, searchProducto])

  function addProducto(p: ProductoWithRelations) {
    if (detalles.some((d) => d.producto_id === p.id)) return
    setDetalles([
      ...detalles,
      {
        producto_id: p.id,
        producto_nombre: `${p.sku ?? ""} — ${p.nombre}`,
        cantidad: "",
        precio_unitario: Number(p.precio_compra) || "",
      },
    ])
    setSearchProducto("")
    setShowSearch(false)
  }

  function updateDetalle(
    index: number,
    field: "cantidad" | "precio_unitario",
    value: string
  ) {
    const updated = [...detalles]
    updated[index] = {
      ...updated[index],
      [field]: value === "" ? "" : Number(value),
    }
    setDetalles(updated)
    if (errores.length > 0) setErrores([])
  }

  function removeDetalle(index: number) {
    setDetalles(detalles.filter((_, i) => i !== index))
  }

  function onSubmit(values: CabeceraValues) {
    const fallos: string[] = []
    if (detalles.length === 0) {
      fallos.push("La entrada debe conservar al menos un producto")
    }
    detalles.forEach((d) => {
      if (d.cantidad === "" || d.cantidad <= 0)
        fallos.push(`"${d.producto_nombre}": la cantidad es obligatoria`)
      if (d.precio_unitario === "" || d.precio_unitario <= 0)
        fallos.push(`"${d.producto_nombre}": el costo unitario es obligatorio`)
    })
    if (fallos.length > 0) {
      setErrores(fallos)
      return
    }
    setErrores([])

    update.mutate(
      {
        id,
        proveedor_id: values.proveedor_id,
        fecha: values.fecha,
        fecha_factura: values.fecha_factura || null,
        numero_factura: values.numero_factura || null,
        notas: values.notas || null,
        detalles: detalles.map((d) => ({
          producto_id: d.producto_id,
          cantidad: Number(d.cantidad),
          precio_unitario: Number(d.precio_unitario),
        })),
      },
      { onSuccess: () => router.push(`/entradas/${id}`) }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!entrada) {
    return <p className="text-muted-foreground">Entrada no encontrada</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/entradas/${id}`}>← Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold">Editar {entrada.folio}</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Editar la entrada ajusta el inventario por la diferencia. Los precios de
        venta del producto no cambian: se corrigen desde su ficha.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  {proveedores.query.data
                    ?.filter((p) => p.activo)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                </select>
                {errors.proveedor_id && (
                  <p className="text-sm text-destructive">
                    {errors.proveedor_id.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input id="fecha" type="date" {...register("fecha")} />
                {errors.fecha && (
                  <p className="text-sm text-destructive">{errors.fecha.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_factura">Fecha factura</Label>
                <Input
                  id="fecha_factura"
                  type="date"
                  {...register("fecha_factura")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numero_factura">N° Factura</Label>
                <Input
                  id="numero_factura"
                  {...register("numero_factura")}
                  placeholder="FAC-001"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                {...register("notas")}
                placeholder="Notas adicionales"
              />
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
                  placeholder="Buscar producto por nombre, SKU o marca..."
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
                <div className="absolute z-10 mt-1 w-full rounded-md border bg-background shadow-lg max-h-96 overflow-y-auto">
                  {filteredProductos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent border-b last:border-b-0 text-left"
                      onClick={() => addProducto(p)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">
                          {p.nombre}
                          {p.marca && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              — {p.marca}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {p.sku && (
                          <div className="font-mono text-xs text-muted-foreground">
                            {p.sku}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(Number(p.precio_compra))}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {errores.length > 0 && (
              <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <ul className="list-disc pl-5 text-sm text-destructive space-y-1">
                  {errores.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {detalles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Busca y agrega productos arriba
                </p>
              )}
              {detalles.map((d, i) => (
                <div key={d.producto_id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate mr-2">
                      {d.producto_nombre}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="text-destructive shrink-0"
                      onClick={() => removeDetalle(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Cantidad
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={d.cantidad}
                        onChange={(e) =>
                          updateDetalle(i, "cantidad", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Costo unitario
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={d.precio_unitario}
                        onChange={(e) =>
                          updateDetalle(i, "precio_unitario", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-medium">
                      Subtotal:{" "}
                      {formatMoney(
                        (Number(d.cantidad) || 0) *
                          (Number(d.precio_unitario) || 0)
                      )}
                    </span>
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

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="w-32 text-right">Cantidad</TableHead>
                    <TableHead className="w-40 text-right">
                      Costo unitario
                    </TableHead>
                    <TableHead className="w-32 text-right">Subtotal</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalles.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        Busca y agrega productos arriba
                      </TableCell>
                    </TableRow>
                  )}
                  {detalles.map((d, i) => (
                    <TableRow key={d.producto_id}>
                      <TableCell className="font-medium">
                        {d.producto_nombre}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          className="text-right"
                          value={d.cantidad}
                          onChange={(e) =>
                            updateDetalle(i, "cantidad", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          className="text-right"
                          value={d.precio_unitario}
                          onChange={(e) =>
                            updateDetalle(i, "precio_unitario", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMoney(
                          (Number(d.cantidad) || 0) *
                            (Number(d.precio_unitario) || 0)
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          className="text-destructive"
                          onClick={() => removeDetalle(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {detalles.length > 0 && (
                <div className="text-right pt-3">
                  <span className="font-bold">Total: </span>
                  <span className="font-bold font-mono">{formatMoney(total)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/entradas/${id}`}>Cancelar</Link>
          </Button>
        </div>
      </form>
    </div>
  )
}
