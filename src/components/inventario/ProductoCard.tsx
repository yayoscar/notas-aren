"use client"

import Link from "next/link"
import type { ProductoWithRelations } from "@/hooks/useProductos"
import { StockBadge } from "@/components/inventario/StockBadge"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/utils"

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  nuevo: { label: "Completo", variant: "default" },
  parcial: { label: "Parcial", variant: "secondary" },
  segunda: { label: "Tester", variant: "outline" },
}

interface Props {
  producto: ProductoWithRelations
}

export function ProductoCard({ producto: p }: Props) {
  const tags = [
    p.cat_genero?.nombre,
    p.cat_presentacion?.nombre,
    p.cat_tamano?.etiqueta,
    p.cat_concentracion?.nombre,
  ].filter(Boolean)

  return (
    <Link
      href={`/inventario/${p.id}`}
      className="block rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
    >
      {/* Fila 1: Nombre + badges + Stock */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold leading-tight truncate">{p.nombre}</span>
            {p.estado_producto && p.estado_producto !== "nuevo" && (
              <Badge
                variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"}
                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
              >
                {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
              </Badge>
            )}
            {p.producto_origen_id && (
              <span className="text-[10px] text-muted-foreground shrink-0">↳ derivado</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{p.marca}</p>
        </div>
        <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
      </div>

      {/* Fila 2: Tags diferenciadores */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="text-[10px] bg-secondary rounded px-1.5 py-0.5 leading-tight">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Fila 3: Precios */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span>
          <span className="text-muted-foreground">Contado </span>
          <span className="font-semibold tabular-nums">{formatMoney(Number(p.precio_venta_contado))}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Crédito </span>
          <span className="font-semibold tabular-nums">{formatMoney(Number(p.precio_venta_credito))}</span>
        </span>
      </div>
    </Link>
  )
}
