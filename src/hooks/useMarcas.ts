"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export function useMarcas() {
  const supabase = createClient()

  const query = useQuery<string[]>({
    queryKey: ["marcas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("marca")
        .neq("marca", "")
        .order("marca")
      if (error) throw error
      const unique = Array.from(new Set(data.map((p) => p.marca.trim())))
      return unique.sort((a, b) => a.localeCompare(b, "es"))
    },
    // Alta o edición de un producto puede estrenar marca. Sus dos consumidores
    // —la tarjeta "Número de marcas" del dashboard y el datalist de
    // ProductoForm— necesitan la lista al día al abrirse, y ninguna mutación
    // invalida esta clave. Es una consulta de una sola columna.
    staleTime: 0,
    refetchOnMount: "always",
  })

  return query
}
