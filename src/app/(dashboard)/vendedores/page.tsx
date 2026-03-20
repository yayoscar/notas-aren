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
import { Plus, Search } from "lucide-react"

export default function VendedoresPage() {
  const { query } = useVendedores()
  const [search, setSearch] = useState("")

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
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Usuario</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden sm:table-cell">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin vendedores registrados
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <Link href={`/vendedores/${v.id}`} className="font-medium hover:underline">
                        {v.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-sm">{v.usuario}</TableCell>
                    <TableCell>{v.telefono}</TableCell>
                    <TableCell>
                      <Badge variant={v.rol === "admin" ? "default" : "secondary"}>
                        {v.rol === "admin" ? "Administrador" : "Vendedor"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={v.activo ? "default" : "secondary"}>
                        {v.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
