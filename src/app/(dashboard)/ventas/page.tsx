"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useVentas } from "@/hooks/useVentas"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, List } from "lucide-react"

type Vista = "inicio" | "listado"

export default function VentasPage() {
  const [vista, setVista] = useState<Vista>("inicio")

  if (vista === "listado") {
    return <VentasListado onBack={() => setVista("inicio")} />
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ventas</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-lg">
        <Link href="/ventas/nueva" className="block">
          <Card className="card-hover cursor-pointer">
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <div className="rounded-full bg-primary/10 p-4">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold">Nueva Venta</p>
              <p className="text-sm text-muted-foreground text-center">
                Registrar una venta nueva
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card
          className="card-hover cursor-pointer"
          onClick={() => setVista("listado")}
        >
          <CardContent className="flex flex-col items-center gap-3 p-8">
            <div className="rounded-full bg-primary/10 p-4">
              <List className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-semibold">Ver Listado</p>
            <p className="text-sm text-muted-foreground text-center">
              Consultar ventas registradas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function VentasListado({ onBack }: { onBack: () => void }) {
  const { query } = useVentas()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!query.data) return []
    if (!search) return query.data
    const s = search.toLowerCase()
    return query.data.filter(
      (v) =>
        v.folio.toLowerCase().includes(s) ||
        v.clientes?.nombre.toLowerCase().includes(s)
    )
  }, [query.data, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            &larr; Inicio
          </Button>
          <h1 className="text-2xl font-bold">Ventas</h1>
        </div>
        <Button asChild>
          <Link href="/ventas/nueva">
            <Plus className="mr-2 h-4 w-4" />
            Nueva venta
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por folio o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Folio</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      Sin registros
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="hidden sm:table-cell">
                      <Link
                        href={`/ventas/${v.id}`}
                        className="font-medium hover:underline"
                      >
                        {v.folio}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/ventas/${v.id}`}
                        className="font-medium hover:underline sm:no-underline sm:pointer-events-none"
                      >
                        {v.clientes?.nombre ?? "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge
                        variant={
                          v.tipo_venta === "contado" ? "default" : "secondary"
                        }
                      >
                        {v.tipo_venta === "contado" ? "Contado" : "Crédito"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {new Date(v.fecha).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${v.total.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {v.tipo_venta === "credito" && (
                        <Badge
                          variant={
                            v.estado_credito === "liquidado"
                              ? "default"
                              : "outline"
                          }
                        >
                          {v.estado_credito === "liquidado"
                            ? "Liquidado"
                            : "Activo"}
                        </Badge>
                      )}
                      {v.tipo_venta === "contado" && (
                        <Badge variant="default">Pagado</Badge>
                      )}
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
