import { Badge } from "@/components/ui/badge"

interface Props {
  stockActual: number
  stockMinimo: number | null
}

export function StockBadge({ stockActual, stockMinimo }: Props) {
  const min = stockMinimo ?? 5

  if (stockActual <= 0) {
    return <Badge variant="destructive">Sin stock</Badge>
  }
  if (stockActual <= min) {
    return <Badge variant="outline" className="border-orange-500 text-orange-600">Stock bajo ({stockActual})</Badge>
  }
  return <Badge variant="secondary">{stockActual}</Badge>
}
