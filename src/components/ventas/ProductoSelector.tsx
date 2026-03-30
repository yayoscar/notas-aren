"use client"

import { useState, useMemo } from "react"
import { useProductos } from "@/hooks/useProductos"
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

  const filtered = useMemo(() => {
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

  function handleSelect(producto: Producto) {
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
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full text-left px-3 py-2.5 hover:bg-secondary transition-colors border-b last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{p.nombre}</p>
                      {p.estado_producto && p.estado_producto !== "nuevo" && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {p.estado_producto === "parcial" ? "Parcial" : "Segunda"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.sku} · {p.marca}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={p.stock_actual > 5 ? "default" : "destructive"}
                      className="text-xs"
                    >
                      Stock: {p.stock_actual}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {precioLabel}:{" "}
                      {formatMoney(
                        tipoVenta === "contado"
                          ? p.precio_venta_contado
                          : p.precio_venta_credito
                      )}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
