"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Vendedor } from "@/lib/supabase/types"

export function useVendedorActual() {
  const supabase = createClient()

  const query = useQuery<Vendedor | null>({
    queryKey: ["vendedor_actual"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle()
      if (error) throw error
      return data as Vendedor | null
    },
  })

  return {
    vendedor: query.data ?? null,
    isAdmin: query.data?.rol === "admin",
    // Un perfil inexistente cuenta como inactivo: quien no tiene perfil no
    // tiene acceso.
    isActivo: query.data?.activo === true,
    isLoading: query.isLoading,
  }
}
