"use client"

import Link from "next/link"
import type { ProductoWithRelations } from "@/hooks/useProductos"
import { StockBadge } from "@/components/inventario/StockBadge"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/utils"

const ESTADO_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  nuevo: { label: "Nuevo", variant: "default" },
  parcial: { label: "Parcial", variant: "secondary" },
  segunda: { label: "Segunda", variant: "outline" },
}

interface Props {
  producto: ProductoWithRelations
}

export function ProductoCard({ producto: p }: Props) {
  return (
    <Link
      href={`/inventario/${p.id}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{p.nombre}</p>
            {p.estado_producto && p.estado_producto !== "nuevo" && (
              <Badge
                variant={ESTADO_BADGE[p.estado_producto]?.variant ?? "outline"}
                className="text-xs shrink-0"
              >
                {ESTADO_BADGE[p.estado_producto]?.label ?? p.estado_producto}
              </Badge>
            )}
            {p.producto_origen_id && (
              <span className="text-xs text-muted-foreground shrink-0">↳ derivado</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {p.marca}
            {p.sku ? ` · ${p.sku}` : ""}
          </p>
        </div>
        <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div>
          <span className="text-muted-foreground">Contado: </span>
          <span className="font-medium tabular-nums">{formatMoney(Number(p.precio_venta_contado))}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Crédito: </span>
          <span className="font-medium tabular-nums">{formatMoney(Number(p.precio_venta_credito))}</span>
        </div>
      </div>
    </Link>
  )
}
