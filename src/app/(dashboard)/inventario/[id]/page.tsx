"use client"

import { useParams, useRouter } from "next/navigation"
import { useProducto, useProductos, useStockMovimientos } from "@/hooks/useProductos"
import { usePreciosHistorico } from "@/hooks/usePreciosHistorico"
import { ProductoForm } from "@/components/inventario/ProductoForm"
import { StockBadge } from "@/components/inventario/StockBadge"
import type { ProductoFormValues } from "@/lib/validations/producto.schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const TIPO_LABELS: Record<string, string> = {
  ENTRADA_COMPRA: "Entrada compra",
  ENTRADA_DEVOLUCION: "Devolución",
  SALIDA_VENTA: "Venta",
  SALIDA_MUESTRA: "Muestra",
  SALIDA_EXHIBICION: "Exhibición",
  SALIDA_MERMA: "Merma",
  AJUSTE_POSITIVO: "Ajuste +",
  AJUSTE_NEGATIVO: "Ajuste -",
}

export default function ProductoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const productoQuery = useProducto(id)
  const movimientos = useStockMovimientos(id)
  const preciosHistorico = usePreciosHistorico(id)
  const { update } = useProductos()

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{p.nombre}</h1>
        <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
      </div>

      <Tabs defaultValue="editar">
        <TabsList>
          <TabsTrigger value="editar">Editar</TabsTrigger>
          <TabsTrigger value="historial">Historial de stock</TabsTrigger>
          <TabsTrigger value="precios">Historial de precios</TabsTrigger>
        </TabsList>

        <TabsContent value="editar" className="mt-4">
          <ProductoForm
            producto={p}
            onSubmit={handleSubmit}
            isPending={update.isPending}
          />
        </TabsContent>

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
                        <TableCell className="text-right font-mono">${Number(ph.precio_compra).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${Number(ph.precio_venta_contado).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${Number(ph.precio_venta_credito).toFixed(2)}</TableCell>
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
