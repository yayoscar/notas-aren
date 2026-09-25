"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useVendedores } from "@/hooks/useVendedores"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EliminarVendedorDialog } from "@/components/vendedores/EliminarVendedorDialog"
import { useVendedorActual } from "@/hooks/useVendedorActual"
import { Plus, Search, Ban, RotateCcw, Trash2 } from "lucide-react"

type VendedorObjetivo = { id: string; nombre: string }

export default function VendedoresPage() {
  const { query, setActivo, remove } = useVendedores()
  const { vendedor: yo } = useVendedorActual()
  const [search, setSearch] = useState("")
  const [porEliminar, setPorEliminar] = useState<VendedorObjetivo | null>(null)

  const filtered = useMemo(() => {
    if (!query.data) return []
    if (!search) return query.data
    const s = search.toLowerCase()
    return query.data.filter(
      (v) =>
        v.nombre.toLowerCase().includes(s) ||
        v.usuario.toLowerCase().includes(s) ||
        v.telefono.includes(s)
    )
  }, [query.data, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Vendedores</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/vendedores/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo vendedor
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, usuario o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Sin vendedores registrados
            </p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {filtered.map((v) => (
                  <div key={v.id} className="rounded-lg border p-3">
                    <Link
                      href={`/vendedores/${v.id}`}
                      className="block transition-opacity hover:opacity-80"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{v.nombre}</span>
                        <Badge variant={v.rol === "admin" ? "default" : "secondary"}>
                          {v.rol === "admin" ? "Administrador" : "Vendedor"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{v.telefono}</span>
                        <Badge variant={v.activo ? "default" : "secondary"}>
                          {v.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {v.usuario && (
                        <div className="mt-1">
                          <span className="text-xs text-muted-foreground font-mono">{v.usuario}</span>
                        </div>
                      )}
                    </Link>
                    <div className="mt-2 flex justify-end gap-1 border-t pt-2">
                      <AccionesVendedor
                        vendedor={v}
                        esYo={yo?.id === v.id}
                        isPending={setActivo.isPending}
                        onToggleActivo={() =>
                          setActivo.mutate({ id: v.id, activo: !v.activo })
                        }
                        onEliminar={() => setPorEliminar({ id: v.id, nombre: v.nombre })}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="w-32" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <Link href={`/vendedores/${v.id}`} className="font-medium hover:underline">
                            {v.nombre}
                          </Link>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{v.usuario}</TableCell>
                        <TableCell>{v.telefono}</TableCell>
                        <TableCell>
                          <Badge variant={v.rol === "admin" ? "default" : "secondary"}>
                            {v.rol === "admin" ? "Administrador" : "Vendedor"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={v.activo ? "default" : "secondary"}>
                            {v.activo ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <AccionesVendedor
                              vendedor={v}
                              esYo={yo?.id === v.id}
                              isPending={setActivo.isPending}
                              onToggleActivo={() =>
                                setActivo.mutate({ id: v.id, activo: !v.activo })
                              }
                              onEliminar={() =>
                                setPorEliminar({ id: v.id, nombre: v.nombre })
                              }
                            />
                          </div>
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

      <EliminarVendedorDialog
        vendedorId={porEliminar?.id ?? null}
        vendedorNombre={porEliminar?.nombre ?? ""}
        open={porEliminar !== null}
        onOpenChange={(open) => !open && setPorEliminar(null)}
        isPending={remove.isPending || setActivo.isPending}
        onConfirmarEliminar={() => {
          if (!porEliminar) return
          remove.mutate(porEliminar.id, { onSettled: () => setPorEliminar(null) })
        }}
        onDesactivarEnSuLugar={() => {
          if (!porEliminar) return
          setActivo.mutate(
            { id: porEliminar.id, activo: false },
            { onSettled: () => setPorEliminar(null) }
          )
        }}
      />
    </div>
  )
}

/**
 * Desactivar / reactivar y eliminar. Mismo planteamiento que el catálogo de
 * tipos de descuento: cuando el registro está activo la acción es darlo de
 * baja, y cuando está inactivo es reactivarlo.
 *
 * Un administrador no puede darse de baja ni eliminarse a sí mismo, así que
 * sobre su propia fila no se ofrecen las acciones.
 */
function AccionesVendedor({
  vendedor,
  esYo,
  isPending,
  onToggleActivo,
  onEliminar,
}: {
  vendedor: { id: string; activo: boolean }
  esYo: boolean
  isPending: boolean
  onToggleActivo: () => void
  onEliminar: () => void
}) {
  if (esYo) {
    return <span className="text-xs text-muted-foreground">Tú</span>
  }

  return (
    <>
      {vendedor.activo ? (
        <Button
          size="icon"
          variant="ghost"
          title="Desactivar"
          disabled={isPending}
          onClick={onToggleActivo}
        >
          <Ban className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          title="Reactivar"
          disabled={isPending}
          onClick={onToggleActivo}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        title="Eliminar definitivamente"
        onClick={onEliminar}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </>
  )
}
