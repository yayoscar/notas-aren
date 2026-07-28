"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useProductos, type ProductoWithRelations } from "@/hooks/useProductos"
import { useCatalogo } from "@/hooks/useCatalogos"
import { StockBadge } from "@/components/inventario/StockBadge"
import { ProductoCard } from "@/components/inventario/ProductoCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, X, PackageCheck, AlertTriangle, Layers, type LucideIcon } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EstadoFilter = "todos" | "nuevo" | "parcial" | "segunda"

// Vista de stock: "disponible" (con stock > 0) por defecto, "bajo" (stock ≤ mínimo),
// "todos" (sin filtrar). El botón cíclico alterna entre estos tres estados.
type StockView = "disponible" | "bajo" | "todos"

const STOCK_VIEWS: { value: StockView; label: string; icon: LucideIcon }[] = [
  { value: "disponible", label: "Con stock", icon: PackageCheck },
  { value: "bajo", label: "Stock bajo", icon: AlertTriangle },
  { value: "todos", label: "Todos", icon: Layers },
]

export default function InventarioPage() {
  const { query } = useProductos()
  const generos = useCatalogo("cat_genero")
  const tamanos = useCatalogo("cat_tamano")
  const presentaciones = useCatalogo("cat_presentacion")
  const concentraciones = useCatalogo("cat_concentracion")
  const [search, setSearch] = useState("")
  // Por defecto mostramos solo productos con stock disponible.
  const [stockView, setStockView] = useState<StockView>("disponible")
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos")
  const [generoFilter, setGeneroFilter] = useState<string>("todos")
  const [tamanoFilter, setTamanoFilter] = useState<string>("todos")
  const [presentacionFilter, setPresentacionFilter] = useState<string>("todos")
  const [concentracionFilter, setConcentracionFilter] = useState<string>("todos")

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

    if (stockView === "disponible") {
      items = items.filter((p) => p.stock_actual > 0)
    } else if (stockView === "bajo") {
      items = items.filter((p) => p.stock_actual <= (p.stock_minimo ?? 5))
    }
    // "todos": sin filtro de stock.

    if (estadoFilter !== "todos") {
      items = items.filter((p) => p.estado_producto === estadoFilter)
    }

    if (generoFilter !== "todos") {
      items = items.filter((p) => p.cat_genero?.nombre === generoFilter)
    }

    if (tamanoFilter !== "todos") {
      items = items.filter((p) => p.cat_tamano?.etiqueta === tamanoFilter)
    }

    if (presentacionFilter !== "todos") {
      items = items.filter((p) => p.cat_presentacion?.nombre === presentacionFilter)
    }

    if (concentracionFilter !== "todos") {
      items = items.filter((p) => p.cat_concentracion?.nombre === concentracionFilter)
    }

    return items
  }, [query.data, search, stockView, estadoFilter, generoFilter, tamanoFilter, presentacionFilter, concentracionFilter])

  const hasActiveFilters = search || stockView !== "disponible" || estadoFilter !== "todos" || generoFilter !== "todos" || tamanoFilter !== "todos" || presentacionFilter !== "todos" || concentracionFilter !== "todos"

  const clearFilters = () => {
    setSearch("")
    setStockView("disponible")
    setEstadoFilter("todos")
    setGeneroFilter("todos")
    setTamanoFilter("todos")
    setPresentacionFilter("todos")
    setConcentracionFilter("todos")
  }

  const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    nuevo: { label: "Completo", variant: "default" },
    parcial: { label: "Parcial", variant: "secondary" },
    segunda: { label: "Tester", variant: "outline" },
  }

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
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, marca o SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={estadoFilter}
                onValueChange={(v) => setEstadoFilter(v as EstadoFilter)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="nuevo">Nuevos</SelectItem>
                  <SelectItem value="parcial">Parciales</SelectItem>
                  <SelectItem value="segunda">Testers</SelectItem>
                </SelectContent>
              </Select>
              <Select value={generoFilter} onValueChange={setGeneroFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Género" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Género</SelectItem>
                  {(generos.query.data ?? []).filter(g => g.activo).map((g) => (
                    <SelectItem key={g.id} value={g.nombre ?? ""}>{g.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tamanoFilter} onValueChange={setTamanoFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Tamaño" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Tamaño</SelectItem>
                  {(tamanos.query.data ?? []).filter(t => t.activo).map((t) => (
                    <SelectItem key={t.id} value={t.etiqueta ?? ""}>{t.etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={presentacionFilter} onValueChange={setPresentacionFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Presentación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Presentación</SelectItem>
                  {(presentaciones.query.data ?? []).filter(p => p.activo).map((p) => (
                    <SelectItem key={p.id} value={p.nombre ?? ""}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={concentracionFilter} onValueChange={setConcentracionFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Concentración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Concentración</SelectItem>
                  {(concentraciones.query.data ?? []).filter(c => c.activo).map((c) => (
                    <SelectItem key={c.id} value={c.nombre ?? ""}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Filtro de stock segmentado: cada opción es clickeable y la activa queda remarcada */}
              <div className="inline-flex h-10 items-center divide-x divide-input overflow-hidden rounded-md border border-input">
                {(STOCK_VIEWS.map((view) => {
                  const active = stockView === view.value
                  const Icon = view.icon
                  return (
                    <Button
                      key={view.value}
                      type="button"
                      variant={active ? "default" : "ghost"}
                      onClick={() => setStockView(view.value)}
                      className="h-10 rounded-none border-0 px-3"
                      title={view.label}
                    >
                      <Icon className="mr-1.5 h-4 w-4" />
                      {view.label}
                    </Button>
                  )
                }))}
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          {query.isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {hasActiveFilters
                ? "No se encontraron resultados"
                : "No hay productos registrados"}
            </p>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="space-y-2 md:hidden">
                {filtered.map((p) => (
                  <ProductoCard key={p.id} producto={p} />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Género</TableHead>
                      <TableHead>Presentación</TableHead>
                      <TableHead>Concentración</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                      <TableHead className="text-right">P. Contado</TableHead>
                      <TableHead className="text-right">P. Crédito</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.marca}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link href={`/inventario/${p.id}`} className="font-medium hover:underline">
                              {p.nombre}
                            </Link>
                            {p.estado_producto && p.estado_producto !== "nuevo" && (
                              <Badge variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"} className="text-xs">
                                {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
                              </Badge>
                            )}
                            {p.producto_origen_id && (
                              <span className="text-xs text-muted-foreground">↳ derivado</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{p.cat_genero?.nombre ?? "—"}</TableCell>
                        <TableCell>{p.cat_presentacion?.nombre ?? "—"}</TableCell>
                        <TableCell>{p.cat_concentracion?.nombre ?? "—"}</TableCell>
                        <TableCell>{p.cat_tamano?.etiqueta ?? "—"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{p.cat_tipo_perfume?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(p.precio_venta_contado))}</TableCell>
                        <TableCell className="text-right">{formatMoney(Number(p.precio_venta_credito))}</TableCell>
                        <TableCell className="text-center">
                          <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
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
