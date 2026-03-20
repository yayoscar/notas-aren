"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useGastos } from "@/hooks/useGastos"
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
import { Plus, Search } from "lucide-react"

export default function GastosPage() {
  const { query } = useGastos()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!query.data) return []
    if (!search) return query.data
    const s = search.toLowerCase()
    return query.data.filter(
      (g) =>
        g.concepto.toLowerCase().includes(s) ||
        g.cat_categoria_gasto?.nombre.toLowerCase().includes(s)
    )
  }, [query.data, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Gastos</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/gastos/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo gasto
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por concepto o categoría..."
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
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo pago</TableHead>
                  <TableHead className="hidden sm:table-cell">Registró</TableHead>
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
                {filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      {new Date(g.fecha).toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell className="font-medium">{g.concepto}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary">
                        {g.cat_categoria_gasto?.nombre ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${g.monto.toFixed(2)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {g.tipo_pago === "efectivo"
                        ? "Efectivo"
                        : g.tipo_pago === "transferencia"
                          ? "Transferencia"
                          : "Retiro s/tarjeta"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {g.vendedores?.nombre ?? "—"}
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
