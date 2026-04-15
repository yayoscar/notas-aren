"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

/**
 * Returns the list of distinct product names already registered for a
 * given marca. Used by ProductoForm to suggest existing names and
 * avoid duplicates created by minor typing variants of the same perfume.
 *
 * Mirrors the pattern of useMarcas, but parameterized by marca.
 * If `marca` is empty/undefined, the query is disabled and returns [].
 */
export function useNombresProducto(marca?: string) {
  const supabase = createClient()
  const trimmed = marca?.trim() ?? ""

  return useQuery<string[]>({
    queryKey: ["nombres_producto", trimmed],
    enabled: trimmed.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("nombre")
        .eq("marca", trimmed)
        .neq("nombre", "")
        .order("nombre")
      if (error) throw error
      const unique = Array.from(new Set(data.map((p) => p.nombre)))
      return unique.sort((a, b) => a.localeCompare(b, "es"))
    },
  })
}
