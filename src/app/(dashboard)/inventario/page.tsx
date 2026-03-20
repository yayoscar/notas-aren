"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useProductos, type ProductoWithRelations } from "@/hooks/useProductos"
import { StockBadge } from "@/components/inventario/StockBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Search, Filter } from "lucide-react"

export default function InventarioPage() {
  const { query } = useProductos()
  const [search, setSearch] = useState("")
  const [stockBajoOnly, setStockBajoOnly] = useState(false)

  const filtered = useMemo((): ProductoWithRelations[] => {
    if (!query.data) return []
    let items = query.data

    if (search) {
      const s = search.toLowerCase()
      items = items.filter(
        (p) =>
          p.nombre.toLowerCase().includes(s) ||
          p.marca.toLowerCase().includes(s) ||
          p.sku?.toLowerCase().includes(s)
      )
    }

    if (stockBajoOnly) {
      items = items.filter((p) => p.stock_actual <= (p.stock_minimo ?? 5))
    }

    return items
  }, [query.data, search, stockBajoOnly])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/inventario/nuevo">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo producto
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={stockBajoOnly ? "default" : "outline"}
              onClick={() => setStockBajoOnly(!stockBajoOnly)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Stock bajo
            </Button>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden sm:table-cell">Marca</TableHead>
                  <TableHead className="hidden lg:table-cell">Género</TableHead>
                  <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                  <TableHead className="text-right">P. Contado</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">P. Crédito</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {search || stockBajoOnly ? "No se encontraron resultados" : "No hay productos registrados"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="hidden sm:table-cell">
                      <Link href={`/inventario/${p.id}`} className="font-mono text-sm hover:underline">
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/inventario/${p.id}`} className="font-medium hover:underline">
                        {p.nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{p.marca}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.cat_genero?.nombre ?? "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.cat_tipo_perfume?.nombre ?? "—"}</TableCell>
                    <TableCell className="text-right">${Number(p.precio_venta_contado).toFixed(2)}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right">${Number(p.precio_venta_credito).toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
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
