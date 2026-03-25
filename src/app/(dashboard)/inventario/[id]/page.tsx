"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useProducto, useProductos, useStockMovimientos } from "@/hooks/useProductos"
import { useDerivados } from "@/hooks/useProductosDerivados"
import { usePreciosHistorico } from "@/hooks/usePreciosHistorico"
import { ProductoForm } from "@/components/inventario/ProductoForm"
import { StockBadge } from "@/components/inventario/StockBadge"
import { RegistrarTesterDialog } from "@/components/inventario/RegistrarTesterDialog"
import { RegistrarParcialDialog } from "@/components/inventario/RegistrarParcialDialog"
import { EditarPrecioDialog } from "@/components/inventario/EditarPrecioDialog"
import type { ProductoFormValues } from "@/lib/validations/producto.schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatMoney } from "@/lib/utils"
import { FlaskConical, DollarSign, PackageMinus } from "lucide-react"
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
  SALIDA_TESTER: "Salida tester",
  ENTRADA_CAMBIO: "Entrada cambio/devolución",
}

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  nuevo: { label: "Nuevo", variant: "default" },
  tester: { label: "Tester", variant: "secondary" },
  parcial: { label: "Parcial", variant: "outline" },
}

export default function ProductoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const productoQuery = useProducto(id)
  const movimientos = useStockMovimientos(id)
  const preciosHistorico = usePreciosHistorico(id)
  const derivadosQuery = useDerivados(id)
  const { update } = useProductos()
  const [testerDialogOpen, setTesterDialogOpen] = useState(false)
  const [precioDialogOpen, setPrecioDialogOpen] = useState(false)
  const [parcialDialogOpen, setParcialDialogOpen] = useState(false)

  function handleSubmit(values: ProductoFormValues) {
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
    )
    update.mutate({ id, ...cleaned } as unknown as Parameters<typeof update.mutate>[0], {
      onSuccess: () => router.push("/inventario"),
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{p.nombre}</h1>
          <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
          {p.estado_producto && p.estado_producto !== "nuevo" && (
            <Badge variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"}>
              {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
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
              onClick={() => setTesterDialogOpen(true)}
            >
              <FlaskConical className="mr-2 h-4 w-4" />
              Registrar como Tester
            </Button>
          )}
          {p.stock_actual > 0 && p.estado_producto !== "parcial" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setParcialDialogOpen(true)}
            >
              <PackageMinus className="mr-2 h-4 w-4" />
              Registrar como Parcial
            </Button>
          )}
        </div>
      </div>

      <RegistrarParcialDialog
        producto={p}
        open={parcialDialogOpen}
        onOpenChange={setParcialDialogOpen}
      />

      <EditarPrecioDialog
        producto={p}
        open={precioDialogOpen}
        onOpenChange={setPrecioDialogOpen}
      />

      {esDerivado && (
        <div className="rounded-md border bg-muted/50 p-3 text-sm flex items-center gap-2">
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
        <RegistrarTesterDialog
          producto={p}
          open={testerDialogOpen}
          onOpenChange={setTesterDialogOpen}
        />
      )}

      <Tabs defaultValue="detalle">
        <TabsList>
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
          <TabsTrigger value="historial">Historial de stock</TabsTrigger>
          <TabsTrigger value="precios">Historial de precios</TabsTrigger>
        </TabsList>

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
            />
          </TabsContent>
        )}

        {!esDerivado && (
        <TabsContent value="derivados" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Testers y Parciales</CardTitle>
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
              ) : (
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
                    {movimientos.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sin movimientos registrados
                        </TableCell>
                      </TableRow>
                    )}
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
              ) : (
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
                    {preciosHistorico.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sin historial de precios registrado
                        </TableCell>
                      </TableRow>
                    )}
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
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
