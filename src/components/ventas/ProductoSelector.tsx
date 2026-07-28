"use client"

import { useState, useMemo } from "react"
import { useProductos, type ProductoWithRelations } from "@/hooks/useProductos"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import type { Producto } from "@/lib/supabase/types"

interface Props {
  tipoVenta: "contado" | "credito"
  onSelect: (producto: Producto) => void
  excludeIds?: string[]
}

export function ProductoSelector({ tipoVenta, onSelect, excludeIds = [] }: Props) {
  const { query } = useProductos()
  const [search, setSearch] = useState("")

  const filtered = useMemo((): ProductoWithRelations[] => {
    if (!query.data) return []
    const s = search.toLowerCase()
    return query.data
      .filter(
        (p) =>
          p.activo &&
          p.stock_actual > 0 &&
          !excludeIds.includes(p.id) &&
          (p.nombre.toLowerCase().includes(s) ||
            (p.sku ?? "").toLowerCase().includes(s) ||
            p.marca.toLowerCase().includes(s))
      )
      .sort((a, b) => {
        // Sort: nuevos first, then parciales, then segundas
        const order: Record<string, number> = { nuevo: 0, parcial: 1, segunda: 2 }
        return (order[a.estado_producto] ?? 0) - (order[b.estado_producto] ?? 0)
      })
      .slice(0, 10)
  }, [query.data, search, excludeIds])

  function handleSelect(producto: ProductoWithRelations) {
    onSelect(producto)
    setSearch("")
  }

  const precioLabel = tipoVenta === "contado" ? "Contado" : "Crédito"

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar producto por nombre, SKU o marca..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {search.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            filtered.map((p) => {
              const atributos = [
                p.cat_presentacion?.nombre,
                p.cat_genero?.nombre,
                p.cat_tamano?.etiqueta,
                p.cat_concentracion?.nombre,
                p.cat_tipo_perfume?.nombre,
              ]
                .filter(Boolean)
                .join(" · ")

              const precioVenta =
                tipoVenta === "contado" ? p.precio_venta_contado : p.precio_venta_credito

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p)}
                  className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{p.nombre}</span>
                      {p.marca && (
                        <span className="text-muted-foreground font-normal">
                          — {p.marca}
                        </span>
                      )}
                      {p.estado_producto && p.estado_producto !== "nuevo" && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {p.estado_producto === "parcial" ? "Parcial" : "Tester"}
                        </Badge>
                      )}
                    </div>
                    {atributos && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {atributos}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {p.sku && (
                      <div className="font-mono text-xs text-muted-foreground">
                        {p.sku}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {precioLabel}: {formatMoney(precioVenta)}
                    </div>
                    <Badge
                      variant={p.stock_actual > 5 ? "default" : "destructive"}
                      className="text-[10px] mt-1"
                    >
                      Stock: {p.stock_actual}
                    </Badge>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
