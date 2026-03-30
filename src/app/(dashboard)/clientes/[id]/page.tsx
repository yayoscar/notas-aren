"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useCliente, useClientes, useReferidos } from "@/hooks/useClientes"
import { useVentasCliente } from "@/hooks/useVentas"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { useLineaCreditoCliente } from "@/hooks/useLineaCredito"
import { ClienteForm } from "@/components/clientes/ClienteForm"
import { EliminarClienteDialog } from "@/components/clientes/EliminarClienteDialog"
import type { ClienteFormValues } from "@/lib/validations/cliente.schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Trash2, CreditCard } from "lucide-react"
import { formatMoney } from "@/lib/utils"

const MapPicker = dynamic(
  () => import("@/components/clientes/MapPicker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-[200px] w-full rounded-md border bg-muted animate-pulse" /> }
)

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  )
}

export default function ClienteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const clienteQuery = useCliente(id)
  const referidos = useReferidos(id)
  const ventasCliente = useVentasCliente(id)
  const { update } = useClientes()
  const { vendedor, isAdmin } = useVendedorActual()
  const lineaCreditoQuery = useLineaCreditoCliente(id)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  function handleSubmit(values: ClienteFormValues) {
    const keepEmpty = new Set(["direccion", "referencia_ubicacion"])
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" && !keepEmpty.has(k) ? null : v])
    )
    update.mutate({ id, ...cleaned } as unknown as Parameters<typeof update.mutate>[0], {
      onSuccess: () => router.push("/clientes"),
    })
  }

  if (clienteQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!clienteQuery.data) {
    return <p className="text-muted-foreground">Cliente no encontrado</p>
  }

  const c = clienteQuery.data
  const canEdit = isAdmin || c.usuario_id === vendedor?.auth_user_id

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{c.nombre}</h1>
        <Badge variant={c.activo ? "default" : "secondary"}>
          {c.activo ? "Activo" : "Inactivo"}
        </Badge>
        <div className="flex gap-2 ml-auto">
          {lineaCreditoQuery.data && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/clientes/${id}/creditos`}>
                <CreditCard className="mr-2 h-4 w-4" />
                Ver créditos
              </Link>
            </Button>
          )}
          {canEdit && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
          </Button>
        )}
        </div>
      </div>

      <Tabs defaultValue="detalle">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max sm:w-auto">
            <TabsTrigger value="detalle">Detalle</TabsTrigger>
            {canEdit && <TabsTrigger value="editar">Editar</TabsTrigger>}
            <TabsTrigger value="referidos">Referidos</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="detalle" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos de contacto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Nombre" value={c.nombre} />
                <DetailRow label="Teléfono" value={c.telefono} />
                <DetailRow label="Correo" value={c.correo} />
                <DetailRow
                  label="Fecha de nacimiento"
                  value={c.fecha_nacimiento ? new Date(c.fecha_nacimiento).toLocaleDateString("es-MX") : null}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ubicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailRow label="Ciudad" value={c.cat_ciudad?.nombre} />
                <DetailRow label="Dirección" value={c.direccion} />
                <DetailRow label="Referencia" value={c.referencia_ubicacion} />
              </div>
              {c.latitud != null && c.longitud != null && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Lat: {Number(c.latitud).toFixed(6)}, Lng: {Number(c.longitud).toFixed(6)}
                    </p>
                    <MapPicker latitud={Number(c.latitud)} longitud={Number(c.longitud)} onChange={() => {}} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Información adicional</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <DetailRow label="Referido por" value={c.referido_por?.nombre} />
                <DetailRow label="Relación con referido" value={c.tipo_relacion_referido} />
                <DetailRow label="Límite de crédito" value={formatMoney(Number(c.limite_credito))} />
                <DetailRow
                  label="Fecha de alta"
                  value={new Date(c.created_at).toLocaleDateString("es-MX")}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canEdit && (
          <TabsContent value="editar" className="mt-4">
            <ClienteForm
              cliente={c}
              onSubmit={handleSubmit}
              isPending={update.isPending}
            />
          </TabsContent>
        )}

        <TabsContent value="referidos" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Clientes referidos</CardTitle>
            </CardHeader>
            <CardContent>
              {referidos.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : referidos.data?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Sin referidos registrados
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {referidos.data?.map((r) => (
                      <Link
                        key={r.id}
                        href={`/clientes/${r.id}`}
                        className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-primary">{r.nombre}</span>
                          <span className="text-xs text-muted-foreground">{r.telefono}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(r.created_at).toLocaleDateString("es-MX")}
                        </p>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Teléfono</TableHead>
                          <TableHead>Fecha alta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referidos.data?.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Link href={`/clientes/${r.id}`} className="font-medium hover:underline">
                                {r.nombre}
                              </Link>
                            </TableCell>
                            <TableCell>{r.telefono}</TableCell>
                            <TableCell>{new Date(r.created_at).toLocaleDateString("es-MX")}</TableCell>
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

        <TabsContent value="historial" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historial de compras</CardTitle>
            </CardHeader>
            <CardContent>
              {ventasCliente.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : ventasCliente.data?.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Sin compras registradas
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {ventasCliente.data?.map((v) => (
                      <Link
                        key={v.id}
                        href={`/ventas/${v.id}`}
                        className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-mono font-medium">{v.folio}</span>
                          <Badge variant={v.tipo_venta === "credito" ? "default" : "outline"}>
                            {v.tipo_venta === "credito" ? "Crédito" : "Contado"}
                          </Badge>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                          <span className="text-muted-foreground">
                            {new Date(v.fecha).toLocaleDateString("es-MX")}
                          </span>
                          <span className="font-mono tabular-nums">{formatMoney(Number(v.total))}</span>
                        </div>
                        {v.tipo_venta === "credito" && v.saldo_restante > 0 && (
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant={v.estado_credito === "liquidado" ? "secondary" : "destructive"}>
                              {v.estado_credito === "activo" ? "Crédito activo" : "Pagado"}
                            </Badge>
                            <span className="text-xs text-orange-600">
                              Pendiente: {formatMoney(v.saldo_restante)}
                            </span>
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Folio</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Saldo pendiente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ventasCliente.data?.map((v) => (
                          <TableRow key={v.id}>
                            <TableCell>
                              <Link href={`/ventas/${v.id}`} className="font-medium hover:underline">
                                {v.folio}
                              </Link>
                            </TableCell>
                            <TableCell>{new Date(v.fecha).toLocaleDateString("es-MX")}</TableCell>
                            <TableCell>
                              <Badge variant={v.tipo_venta === "credito" ? "default" : "outline"}>
                                {v.tipo_venta === "credito" ? "Crédito" : "Contado"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatMoney(Number(v.total))}</TableCell>
                            <TableCell>
                              {v.tipo_venta === "credito" ? (
                                <Badge variant={v.estado_credito === "liquidado" ? "secondary" : "destructive"}>
                                  {v.estado_credito === "activo" ? "Crédito activo" : "Pagado"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Pagada</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {v.tipo_venta === "credito" ? formatMoney(v.saldo_restante) : "—"}
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

      <EliminarClienteDialog
        clienteId={id}
        clienteNombre={c.nombre}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={() => router.push("/clientes")}
      />
    </div>
  )
}
