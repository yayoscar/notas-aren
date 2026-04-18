"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export type NombreProducto = { nombre: string; marca: string }

export function useNombresProducto() {
  const supabase = createClient()

  return useQuery<NombreProducto[]>({
    queryKey: ["nombres_producto"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("nombre, marca")
        .neq("nombre", "")

      if (error) throw error

      const seen = new Map<string, string>()
      for (const p of data) {
        const nombre = p.nombre.trim()
        const marca = p.marca.trim()
        if (!nombre || !marca) continue
        if (!seen.has(nombre)) {
          seen.set(nombre, marca)
        }
      }

      return Array.from(seen.entries())
        .map(([nombre, marca]) => ({ nombre, marca }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    },
  })
}
