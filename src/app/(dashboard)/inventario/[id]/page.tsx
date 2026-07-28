"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProducto, useProductos, useStockMovimientos } from "@/hooks/useProductos"
import { useDerivados } from "@/hooks/useProductosDerivados"
import { usePreciosHistorico } from "@/hooks/usePreciosHistorico"
import { useSetDetalle } from "@/hooks/useSetDetalle"
import { ProductoForm } from "@/components/inventario/ProductoForm"
import { StockBadge } from "@/components/inventario/StockBadge"
import { RegistrarParcialDialog } from "@/components/inventario/RegistrarParcialDialog"
import { RegistrarSegundaDialog } from "@/components/inventario/RegistrarSegundaDialog"
import { EditarPrecioDialog } from "@/components/inventario/EditarPrecioDialog"
import type { ProductoFormValues } from "@/lib/validations/producto.schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMoney } from "@/lib/utils"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { FlaskConical, DollarSign, PackageMinus, Trash2 } from "lucide-react"
import Link from "next/link"

const TIPO_LABELS: Record<string, string> = {
  ENTRADA_COMPRA: "Entrada compra",
  ENTRADA_DEVOLUCION: "Devolución",
  SALIDA_VENTA: "Venta",
  SALIDA_MUESTRA: "Muestra",
  SALIDA_EXHIBICION: "Exhibición",
  SALIDA_MERMA: "Merma",
  AJUSTE_POSITIVO: "Ajuste +",
  AJUSTE_NEGATIVO: "Ajuste -",
  SALIDA_PARCIAL: "Salida parcial",
  ENTRADA_CAMBIO: "Entrada cambio/devolución",
}

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  nuevo: { label: "Completo", variant: "default" },
  parcial: { label: "Parcial", variant: "secondary" },
  segunda: { label: "Tester", variant: "outline" },
}

export default function ProductoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const productoQuery = useProducto(id)
  const movimientos = useStockMovimientos(id)
  const preciosHistorico = usePreciosHistorico(id)
  const derivadosQuery = useDerivados(id)
  const setDetalleQuery = useSetDetalle(id)
  const { update, remove } = useProductos()
  const [parcialDialogOpen, setParcialDialogOpen] = useState(false)
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false)
  const [segundaDialogOpen, setSegundaDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  function handleSubmit(values: ProductoFormValues) {
    const { set_items, ...rest } = values
    const cleaned = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === "" ? null : v])
    )
    update.mutate({ id, ...cleaned } as unknown as Parameters<typeof update.mutate>[0], {
      onSuccess: () => {
        if (set_items && set_items.length > 0) {
          setDetalleQuery.sync.mutate(
            { productoId: id, items: set_items },
            { onSettled: () => router.push("/inventario") }
          )
        } else {
          setDetalleQuery.deleteAll.mutate(id, {
            onSettled: () => router.push("/inventario"),
          })
        }
      },
    })
  }

  if (productoQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!productoQuery.data) {
    return <p className="text-muted-foreground">Producto no encontrado</p>
  }

  const p = productoQuery.data
  const esDerivado = !!p.producto_origen_id

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold sm:text-2xl">{p.nombre}</h1>
          <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
          {p.estado_producto && p.estado_producto !== "nuevo" && (
            <Badge variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"}>
              {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrecioDialogOpen(true)}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Editar precio
          </Button>
          {!esDerivado && p.estado_producto === "nuevo" && p.stock_actual > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParcialDialogOpen(true)}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Registrar como Parcial
            </Button>
          )}
          {p.stock_actual > 0 && p.estado_producto !== "segunda" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSegundaDialogOpen(true)}
            >
              <PackageMinus className="mr-2 h-4 w-4" />
              Registrar como Tester
            </Button>
          )}
          {!esDerivado && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={remove.isPending}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      <RegistrarSegundaDialog
        producto={p}
        open={segundaDialogOpen}
        onOpenChange={setSegundaDialogOpen}
      />

      <EditarPrecioDialog
        producto={p}
        open={precioDialogOpen}
        onOpenChange={setPrecioDialogOpen}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          remove.mutate(id, {
            onSuccess: () => router.push("/inventario"),
            onSettled: () => setDeleteDialogOpen(false),
          })
        }}
        isPending={remove.isPending}
        title="¿Eliminar este producto?"
        description="Si el producto tiene movimientos, ventas, entradas o devoluciones, no se podrá eliminar. Esta acción no se puede deshacer."
      />

      {esDerivado && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-muted-foreground">
            Este producto es un derivado ({p.estado_producto}) y no se puede editar directamente.
          </span>
          <Link
            href={`/inventario/${p.producto_origen_id}`}
            className="text-primary hover:underline font-medium"
          >
            Ver producto original →
          </Link>
        </div>
      )}

      {!esDerivado && (
        <RegistrarParcialDialog
          producto={p}
          open={parcialDialogOpen}
          onOpenChange={setParcialDialogOpen}
        />
      )}

      <Tabs defaultValue="detalle">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            {!esDerivado && <TabsTrigger value="editar">Editar</TabsTrigger>}
            {!esDerivado && (
              <TabsTrigger value="derivados">
                Derivados
                {derivadosQuery.data && derivadosQuery.data.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                    {derivadosQuery.data.length}
                  </span>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="historial">Stock</TabsTrigger>
            <TabsTrigger value="precios">Precios</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalle" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Información del producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Nombre</p>
                  <p className="text-sm font-medium">{p.nombre}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Marca</p>
                  <p className="text-sm font-medium">{p.marca}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">SKU</p>
                  <p className="text-sm font-medium font-mono">{p.sku || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Género</p>
                  <p className="text-sm font-medium">{p.cat_genero?.nombre ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tamaño</p>
                  <p className="text-sm font-medium">{p.cat_tamano?.etiqueta ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Presentación</p>
                  <p className="text-sm font-medium">{p.cat_presentacion?.nombre ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Concentración</p>
                  <p className="text-sm font-medium">{p.cat_concentracion?.nombre ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium">{p.cat_tipo_perfume?.nombre ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Proveedor</p>
                  <p className="text-sm font-medium">{p.proveedores?.nombre ?? "—"}</p>
                </div>
              </div>

              <div className="mt-6 rounded-md border bg-muted/30 p-4">
                <p className="text-sm font-semibold mb-3">Precios actuales</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Compra</p>
                    <p className="text-lg font-bold font-mono">{formatMoney(p.precio_compra)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Venta contado</p>
                    <p className="text-lg font-bold font-mono">{formatMoney(p.precio_venta_contado)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Venta crédito</p>
                    <p className="text-lg font-bold font-mono">{formatMoney(p.precio_venta_credito)}</p>
                  </div>
                </div>
              </div>

              {setDetalleQuery.query.data && setDetalleQuery.query.data.length > 0 && (
                <div className="mt-6 rounded-md border bg-muted/30 p-4">
                  <p className="text-sm font-semibold mb-3">Artículos del Set</p>
                  <div className="space-y-2">
                    {setDetalleQuery.query.data.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span>
                          <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                          {item.descripcion}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          x{item.cantidad.toLocaleString("es-MX")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Stock actual</p>
                  <p className="text-sm font-medium font-mono">{p.stock_actual}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Stock mínimo</p>
                  <p className="text-sm font-medium font-mono">{p.stock_minimo ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Estado</p>
                  <Badge variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"}>
                    {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Activo</p>
                  <p className="text-sm font-medium">{p.activo ? "Sí" : "No"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {!esDerivado && (
          <TabsContent value="editar" className="mt-4">
            <ProductoForm
              producto={p}
              onSubmit={handleSubmit}
              isPending={update.isPending}
              initialSetItems={setDetalleQuery.query.data?.map((d) => ({
                descripcion: d.descripcion,
                cantidad: d.cantidad,
              }))}
            />
          </TabsContent>
        )}

        {!esDerivado && (
        <TabsContent value="derivados" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Parciales y Testers</CardTitle>
            </CardHeader>
            <CardContent>
              {derivadosQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : derivadosQuery.data?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Sin productos derivados
                </p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="space-y-2 md:hidden">
                    {derivadosQuery.data?.map((d) => (
                      <Link
                        key={d.id}
                        href={`/inventario/${d.id}`}
                        className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary">{d.nombre}</span>
                            <Badge variant={ESTADO_BADGE[d.estado_producto]?.variant ?? "outline"} className="text-xs">
                              {ESTADO_BADGE[d.estado_producto]?.label ?? d.estado_producto}
                            </Badge>
                          </div>
                          <span className="text-sm font-mono">{d.stock_actual} uds</span>
                        </div>
                        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
                          <span>Contado: <span className="font-medium text-foreground tabular-nums">{formatMoney(d.precio_venta_contado)}</span></span>
                          <span>Crédito: <span className="font-medium text-foreground tabular-nums">{formatMoney(d.precio_venta_credito)}</span></span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Precio contado</TableHead>
                          <TableHead className="text-right">Precio crédito</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {derivadosQuery.data?.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>
                              <Link
                                href={`/inventario/${d.id}`}
                                className="text-primary hover:underline"
                              >
                                {d.nombre}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant={ESTADO_BADGE[d.estado_producto]?.variant ?? "outline"}>
                                {ESTADO_BADGE[d.estado_producto]?.label ?? d.estado_producto}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{d.stock_actual}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(d.precio_venta_contado)}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(d.precio_venta_credito)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Movimientos de stock</CardTitle>
            </CardHeader>
            <CardContent>
              {movimientos.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : movimientos.data?.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  Sin movimientos registrados
                </p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="space-y-2 md:hidden">
                    {movimientos.data?.map((m) => (
                      <div key={m.id} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={m.cantidad > 0 ? "default" : "destructive"} className="text-xs">
                            {TIPO_LABELS[m.tipo] ?? m.tipo}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleDateString("es-MX")}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                          <span className={`text-lg font-bold font-mono ${m.cantidad > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.stock_antes} → {m.stock_despues}
                          </span>
                        </div>
                        {m.notas && (
                          <p className="mt-1 text-xs text-muted-foreground">{m.notas}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Antes</TableHead>
                          <TableHead className="text-right">Después</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimientos.data?.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell>{new Date(m.created_at).toLocaleDateString("es-MX")}</TableCell>
                            <TableCell>
                              <Badge variant={m.cantidad > 0 ? "default" : "destructive"}>
                                {TIPO_LABELS[m.tipo] ?? m.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                            </TableCell>
                            <TableCell className="text-right">{m.stock_antes}</TableCell>
                            <TableCell className="text-right">{m.stock_despues}</TableCell>
                            <TableCell>{m.notas ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="precios" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de precios</CardTitle>
            </CardHeader>
            <CardContent>
              {preciosHistorico.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : preciosHistorico.data?.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">
                  Sin historial de precios registrado
                </p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="space-y-2 md:hidden">
                    {preciosHistorico.data?.map((ph) => (
                      <div
                        key={ph.id}
                        className={`rounded-lg border p-3 ${ph.activo ? "bg-accent/50 border-primary/20" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {new Date(ph.created_at).toLocaleDateString("es-MX")}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              {ph.origen === "inventario" ? "Inventario" : "Entrada"}
                            </Badge>
                            {ph.activo && <Badge className="text-xs">Activo</Badge>}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Compra</p>
                            <p className="text-sm font-medium font-mono tabular-nums">{formatMoney(Number(ph.precio_compra))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Contado</p>
                            <p className="text-sm font-medium font-mono tabular-nums">{formatMoney(Number(ph.precio_venta_contado))}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Crédito</p>
                            <p className="text-sm font-medium font-mono tabular-nums">{formatMoney(Number(ph.precio_venta_credito))}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Compra</TableHead>
                          <TableHead className="text-right">Contado</TableHead>
                          <TableHead className="text-right">Crédito</TableHead>
                          <TableHead>Origen</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preciosHistorico.data?.map((ph) => (
                          <TableRow key={ph.id} className={ph.activo ? "bg-accent/50" : ""}>
                            <TableCell>{new Date(ph.created_at).toLocaleDateString("es-MX")}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(Number(ph.precio_compra))}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(Number(ph.precio_venta_contado))}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(Number(ph.precio_venta_credito))}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ph.origen === "inventario" ? "Inventario" : "Entrada"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {ph.activo ? (
                                <Badge>Activo</Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
