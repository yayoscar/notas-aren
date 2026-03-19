"use client"

import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useCliente, useClientes, useReferidos } from "@/hooks/useClientes"
import { useVentasCliente } from "@/hooks/useVentas"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { ClienteForm } from "@/components/clientes/ClienteForm"
import type { ClienteFormValues } from "@/lib/validations/cliente.schema"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

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

  function handleSubmit(values: ClienteFormValues) {
    const cleaned = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === "" ? null : v])
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
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{c.nombre}</h1>
        <Badge variant={c.activo ? "default" : "secondary"}>
          {c.activo ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <Tabs defaultValue="detalle">
        <TabsList>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          {canEdit && <TabsTrigger value="editar">Editar</TabsTrigger>}
          <TabsTrigger value="referidos">Referidos</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

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
                <DetailRow label="Límite de crédito" value={`$${Number(c.limite_credito).toFixed(2)}`} />
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
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Fecha alta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referidos.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Sin referidos registrados
                        </TableCell>
                      </TableRow>
                    )}
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
              ) : (
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
                    {ventasCliente.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Sin compras registradas
                        </TableCell>
                      </TableRow>
                    )}
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
                        <TableCell className="text-right">${Number(v.total).toFixed(2)}</TableCell>
                        <TableCell>
                          {v.tipo_venta === "credito" ? (
                            <Badge variant={v.estado_credito === "liquidado" ? "secondary" : "destructive"}>
                              {v.estado_credito === "activo" ? "Crédito activo" : "Liquidado"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pagada</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.tipo_venta === "credito" ? `$${v.saldo_restante.toFixed(2)}` : "—"}
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
