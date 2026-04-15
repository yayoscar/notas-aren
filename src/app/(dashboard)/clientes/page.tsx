"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useClientes } from "@/hooks/useClientes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Cake } from "lucide-react"

export default function ClientesPage() {
  const { query } = useClientes()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!query.data) return []
    if (!search) return query.data
    const s = search.toLowerCase()
    return query.data.filter(
      (c) =>
        c.nombre.toLowerCase().includes(s) ||
        c.telefono.includes(s) ||
        c.cat_ciudad?.nombre?.toLowerCase().includes(s)
    )
  }, [query.data, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/clientes/cumpleanos">
              <Cake className="mr-2 h-4 w-4" />
              Cumpleaños
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link href="/clientes/nuevo">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o ciudad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              {/* Mobile card view */}
              <div className="space-y-2 md:hidden">
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Sin clientes registrados
                  </p>
                )}
                {filtered.map((c) => (
                  <Link
                    key={c.id}
                    href={`/clientes/${c.id}`}
                    className="block rounded-lg border p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.nombre}</span>
                      <Badge variant={c.activo ? "default" : "secondary"}>
                        {c.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{c.telefono}</span>
                      <span>{c.cat_ciudad?.nombre ?? "—"}</span>
                    </div>
                    {c.referido_por?.nombre && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ref: {c.referido_por.nombre}
                      </div>
                    )}
                  </Link>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Referido por</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Sin clientes registrados
                        </TableCell>
                      </TableRow>
                    )}
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                            {c.nombre}
                          </Link>
                        </TableCell>
                        <TableCell>{c.telefono}</TableCell>
                        <TableCell>{c.cat_ciudad?.nombre ?? "—"}</TableCell>
                        <TableCell>{c.referido_por?.nombre ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={c.activo ? "default" : "secondary"}>
                            {c.activo ? "Activo" : "Inactivo"}
                          </Badge>
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
    </div>
  )
}
