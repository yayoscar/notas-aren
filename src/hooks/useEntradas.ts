"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Entrada } from "@/lib/supabase/types"
import { toast } from "sonner"

export type EntradaWithProveedor = Entrada & {
  proveedores: { nombre: string } | null
}

interface EntradaDetalleInput {
  producto_id: string
  cantidad: number
  precio_unitario: number
}

interface CrearEntradaInput {
  proveedor_id: string
  fecha: string
  fecha_factura?: string | null
  numero_factura?: string | null
  notas?: string | null
  detalles: EntradaDetalleInput[]
}

export function useEntradas() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<EntradaWithProveedor[]>({
    queryKey: ["entradas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entradas")
        .select(`*, proveedores(nombre)`)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data as EntradaWithProveedor[]
    },
  })

  const create = useMutation({
    mutationFn: async (input: CrearEntradaInput) => {
      const { detalles, ...entradaData } = input

      const total = detalles.reduce(
        (sum, d) => sum + d.cantidad * d.precio_unitario,
        0
      )

      const { data: entrada, error: entradaError } = await supabase
        .from("entradas")
        .insert({ ...entradaData, total })
        .select()
        .single()
      if (entradaError) throw entradaError

      const detailRows = detalles.map((d) => ({
        entrada_id: entrada.id as string,
        producto_id: d.producto_id,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
      }))

      const { error: detalleError } = await supabase
        .from("entradas_detalle")
        .insert(detailRows)
      if (detalleError) throw detalleError

      return entrada
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entradas"] })
      queryClient.invalidateQueries({ queryKey: ["productos"] })
      toast.success("Entrada registrada exitosamente")
    },
    onError: () => toast.error("Error al registrar entrada"),
  })

  return { query, create }
}
