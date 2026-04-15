"use client"

import Link from "next/link"
import { Cake } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCumpleanerosSemanaCount } from "@/hooks/useCumpleaneros"

export function CumpleanosWidget() {
  const { data, isLoading } = useCumpleanerosSemanaCount()
  const count = data ?? 0
  const destacar = count >= 1

  return (
    <Link href="/clientes/cumpleanos?filtro=semana" className="block">
      <Card className="card-hover border-border/60 h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cumpleañeros esta semana
          </CardTitle>
          <div
            className={`rounded-lg bg-secondary p-2 ${destacar ? "text-brand-terracotta" : "text-muted-foreground"}`}
          >
            <Cake className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p
              className={`text-2xl font-body font-bold tabular-nums ${destacar ? "text-brand-terracotta" : ""}`}
            >
              {count.toLocaleString("es-MX")}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
