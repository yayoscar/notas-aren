"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import {
  diasHastaCumple,
  edadProxima,
  estaEnRango,
  type RangoCumple,
} from "@/lib/cumpleanos"

export type ClienteCumpleanero = {
  id: string
  nombre: string
  telefono: string
  fecha_nacimiento: string
  diasRestantes: number
  edadProxima: number
}

type ClienteRow = {
  id: string
  nombre: string
  telefono: string
  fecha_nacimiento: string | null
  activo: boolean
}

export function useCumpleaneros(rango: RangoCumple) {
  const supabase = createClient()

  return useQuery<ClienteCumpleanero[]>({
    queryKey: ["cumpleaneros", rango],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nombre, telefono, fecha_nacimiento, activo")
        .not("fecha_nacimiento", "is", null)
        .eq("activo", true)
      if (error) throw error

      const hoy = new Date()
      const rows = (data ?? []) as ClienteRow[]

      return rows
        .filter((c): c is ClienteRow & { fecha_nacimiento: string } => !!c.fecha_nacimiento)
        .map((c) => ({
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          fecha_nacimiento: c.fecha_nacimiento,
          diasRestantes: diasHastaCumple(c.fecha_nacimiento, hoy),
          edadProxima: edadProxima(c.fecha_nacimiento, hoy),
        }))
        .filter((c) => estaEnRango(c.diasRestantes, rango, hoy))
        .sort((a, b) => a.diasRestantes - b.diasRestantes)
    },
  })
}

export function useCumpleanerosSemanaCount() {
  const supabase = createClient()

  return useQuery<number>({
    queryKey: ["cumpleaneros", "semana", "count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("fecha_nacimiento")
        .not("fecha_nacimiento", "is", null)
        .eq("activo", true)
      if (error) throw error

      const hoy = new Date()
      const rows = (data ?? []) as { fecha_nacimiento: string | null }[]

      return rows
        .filter((c): c is { fecha_nacimiento: string } => !!c.fecha_nacimiento)
        .map((c) => diasHastaCumple(c.fecha_nacimiento, hoy))
        .filter((dias) => estaEnRango(dias, "semana", hoy)).length
    },
  })
}
