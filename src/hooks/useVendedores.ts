"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Vendedor, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export function useVendedores() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<Vendedor[]>({
    queryKey: ["vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .order("nombre")
      if (error) throw error
      return data as Vendedor[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: {
      nombre: string
      telefono: string
      usuario: string
      rol: string
      password: string
    }) => {
      const res = await fetch("/api/vendedores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al crear vendedor")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedores"] })
      toast.success("Vendedor creado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: UpdateTables<"vendedores"> & { id: string }) => {
      const { data, error } = await supabase
        .from("vendedores")
        .update(values)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedores"] })
      toast.success("Vendedor actualizado")
    },
    onError: () => toast.error("Error al actualizar vendedor"),
  })

  const resetPassword = useMutation({
    mutationFn: async ({ vendedorId, password }: { vendedorId: string; password: string }) => {
      const res = await fetch(`/api/vendedores/${vendedorId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al resetear contraseña")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedores"] })
      toast.success("Contraseña reseteada")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // La baja pasa por el servidor, no por la tabla: hay que verificar el rol,
  // impedir que un administrador se dé de baja a sí mismo y revocar el acceso
  // en el proveedor de identidad. Ver src/app/api/vendedores/[id]/route.ts
  const setActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const res = await fetch(`/api/vendedores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al cambiar el estado del vendedor")
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["vendedores"] })
      queryClient.invalidateQueries({ queryKey: ["vendedores", variables.id] })
      toast.success(
        variables.activo ? "Vendedor reactivado" : "Vendedor desactivado"
      )
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendedores/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al eliminar vendedor")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendedores"] })
      toast.success("Vendedor eliminado")
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return { query, create, update, resetPassword, setActivo, remove }
}

export interface BloqueoEliminacion {
  etiqueta: string
  cantidad: number
}

export interface ChequeoEliminacion {
  puedeEliminar: boolean
  esPropio: boolean
  bloqueos: BloqueoEliminacion[]
}

/**
 * Pregunta al servidor si un perfil se puede eliminar. Sólo se ejecuta cuando
 * el diálogo está abierto: no tiene sentido contar registros de cada vendedor
 * de la lista por si acaso.
 */
export function useChequeoEliminacion(id: string | null) {
  return useQuery<ChequeoEliminacion>({
    queryKey: ["vendedores", id, "chequeo-eliminacion"],
    queryFn: async () => {
      const res = await fetch(`/api/vendedores/${id}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Error al revisar el vendedor")
      }
      return res.json()
    },
    enabled: !!id,
    staleTime: 0,
  })
}

export function useVendedor(id: string) {
  const supabase = createClient()

  return useQuery<Vendedor>({
    queryKey: ["vendedores", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("id", id)
        .single()
      if (error) throw error
      return data as Vendedor
    },
    enabled: !!id,
  })
}
