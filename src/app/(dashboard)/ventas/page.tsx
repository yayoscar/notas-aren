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
import { formatMoney } from "@/lib/utils"

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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EstadoVentaFilter = "activas" | "canceladas" | "todas"

function VentasListado({ onBack }: { onBack: () => void }) {
  const { query } = useVentas()
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<EstadoVentaFilter>("activas")

  const filtered = useMemo(() => {
    if (!query.data) return []
    let items = query.data

    if (estadoFilter === "activas") {
      items = items.filter((v) => v.estado_venta !== "cancelada")
    } else if (estadoFilter === "canceladas") {
      items = items.filter((v) => v.estado_venta === "cancelada")
    }

    if (!search) return items
    const s = search.toLowerCase()
    return items.filter(
      (v) =>
        v.folio.toLowerCase().includes(s) ||
        v.clientes?.nombre.toLowerCase().includes(s) ||
        (v.vendedores?.nombre ?? "").toLowerCase().includes(s)
    )
  }, [query.data, search, estadoFilter])

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
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por folio, cliente o vendedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={estadoFilter}
              onValueChange={(v) => setEstadoFilter(v as EstadoVentaFilter)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activas">Activas</SelectItem>
                <SelectItem value="canceladas">Canceladas</SelectItem>
                <SelectItem value="todas">Todas</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead className="hidden md:table-cell">Vendedor</TableHead>
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
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      Sin registros
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((v) => (
                  <TableRow
                    key={v.id}
                    className={v.estado_venta === "cancelada" ? "opacity-50" : ""}
                  >
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
                    <TableCell className="hidden md:table-cell">
                      {v.vendedores?.nombre ?? "—"}
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
                      {formatMoney(v.total)}
                    </TableCell>
                    <TableCell>
                      {v.estado_venta === "cancelada" ? (
                        <Badge variant="destructive">Cancelada</Badge>
                      ) : v.tipo_venta === "credito" ? (
                        <Badge
                          variant={
                            v.estado_credito === "liquidado"
                              ? "default"
                              : "outline"
                          }
                        >
                          {v.estado_credito === "liquidado"
                            ? "Pagado"
                            : "Activo"}
                        </Badge>
                      ) : (
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
