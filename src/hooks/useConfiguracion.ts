"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function useConfigValue(key: string) {
  const supabase = createClient()

  return useQuery<string | null>({
    queryKey: ["configuracion", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracion")
        .select("value")
        .eq("key", key)
        .maybeSingle()
      if (error) throw error
      return data?.value ?? null
    },
    enabled: !!key,
  })
}

export function useUpdateConfigValue() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { key: string; value: string }) => {
      const { error } = await supabase
        .from("configuracion")
        .upsert(
          { key: input.key, value: input.value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )
      if (error) throw error
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ["configuracion", input.key] })
      toast.success("Configuracion guardada")
    },
    onError: () => toast.error("Error al guardar configuracion"),
  })
}
