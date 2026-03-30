"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Cliente, InsertTables, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export type ClienteWithRelations = Cliente & {
  cat_ciudad: { nombre: string } | null
  referido_por: { nombre: string } | null
}

export function useClientes() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const query = useQuery<ClienteWithRelations[]>({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          cat_ciudad(nombre)
        `)
        .order("nombre")
      if (error) throw error
      // Resolve referido_por in-memory (self-join can fail in PostgREST)
      const clientes = data as unknown as (Cliente & { cat_ciudad: { nombre: string } | null })[]
      return clientes.map((c) => ({
        ...c,
        referido_por: c.cliente_referido_id
          ? clientes.find((r) => r.id === c.cliente_referido_id)
            ? { nombre: clientes.find((r) => r.id === c.cliente_referido_id)!.nombre }
            : null
          : null,
      }))
    },
  })

  const create = useMutation({
    mutationFn: async (values: InsertTables<"clientes">) => {
      const { data, error } = await supabase.from("clientes").insert(values).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success("Cliente creado")
    },
    onError: () => toast.error("Error al crear cliente"),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...values }: UpdateTables<"clientes"> & { id: string }) => {
      const { data, error } = await supabase.from("clientes").update(values).eq("id", id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      toast.success("Cliente actualizado")
    },
    onError: () => toast.error("Error al actualizar cliente"),
  })

  return { query, create, update }
}

export function useCliente(id: string) {
  const supabase = createClient()

  return useQuery<ClienteWithRelations>({
    queryKey: ["clientes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          cat_ciudad(nombre)
        `)
        .eq("id", id)
        .single()
      if (error) throw error
      const cliente = data as unknown as Cliente & { cat_ciudad: { nombre: string } | null }
      let referido_por: { nombre: string } | null = null
      if (cliente.cliente_referido_id) {
        const { data: ref } = await supabase
          .from("clientes")
          .select("nombre")
          .eq("id", cliente.cliente_referido_id)
          .single()
        if (ref) referido_por = { nombre: ref.nombre }
      }
      return { ...cliente, referido_por }
    },
    enabled: !!id,
  })
}

export function useReferidos(clienteId: string) {
  const supabase = createClient()

  return useQuery<Cliente[]>({
    queryKey: ["clientes", clienteId, "referidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("cliente_referido_id", clienteId)
        .order("nombre")
      if (error) throw error
      return data as Cliente[]
    },
    enabled: !!clienteId,
  })
}

export function useClienteDeletionCheck(clienteId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ["cliente_deletion_check", clienteId],
    queryFn: async () => {
      // 1. Check active credit lines
      const { data: lineaActiva } = await supabase
        .from("lineas_credito")
        .select("saldo_total, saldo_pagado")
        .eq("cliente_id", clienteId)
        .eq("estado", "activa")
        .maybeSingle()

      const creditoActivo = !!lineaActiva
      const saldoPendiente = lineaActiva
        ? lineaActiva.saldo_total - lineaActiva.saldo_pagado
        : 0

      // 2. Count history
      const [ventasRes, pagosRes, lineasLiqRes] = await Promise.all([
        supabase
          .from("ventas")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId),
        supabase
          .from("pagos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId),
        supabase
          .from("lineas_credito")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId)
          .eq("estado", "liquidada"),
      ])

      const countVentas = ventasRes.count ?? 0
      const countPagos = pagosRes.count ?? 0
      const countLineasLiquidadas = lineasLiqRes.count ?? 0

      // 3. Check referral relationships
      const { data: referidos } = await supabase
        .from("clientes")
        .select("id, nombre")
        .eq("cliente_referido_id", clienteId)

      const tieneHistorial =
        countVentas > 0 || countPagos > 0 || countLineasLiquidadas > 0

      return {
        creditoActivo,
        saldoPendiente,
        countVentas,
        countPagos,
        countLineasLiquidadas,
        referidos: referidos ?? [],
        tieneHistorial,
      }
    },
    enabled: !!clienteId,
  })
}

export function useEliminarCliente() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { clienteId: string }) => {
      const { clienteId } = input

      // Safety check: verify no active credit
      const { data: lineaActiva } = await supabase
        .from("lineas_credito")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("estado", "activa")
        .maybeSingle()

      if (lineaActiva) {
        throw new Error("No se puede eliminar un cliente con crédito activo")
      }

      // 1. Clear referral relationships (SET NULL)
      await supabase
        .from("clientes")
        .update({ cliente_referido_id: null })
        .eq("cliente_referido_id", clienteId)

      // 2. Get IDs for cascade delete
      const { data: ventas } = await supabase
        .from("ventas")
        .select("id")
        .eq("cliente_id", clienteId)
      const ventaIds = (ventas ?? []).map((v) => v.id)

      const { data: devoluciones } = await supabase
        .from("devoluciones")
        .select("id")
        .eq("cliente_id", clienteId)
      const devolucionIds = (devoluciones ?? []).map((d) => d.id)

      const { data: lineas } = await supabase
        .from("lineas_credito")
        .select("id")
        .eq("cliente_id", clienteId)
      const lineaIds = (lineas ?? []).map((l) => l.id)

      // 3. Delete in FK order
      if (lineaIds.length > 0) {
        await supabase
          .from("cobranza_seguimiento")
          .delete()
          .in("linea_credito_id", lineaIds)
      }
      if (ventaIds.length > 0) {
        await supabase
          .from("ventas_historial")
          .delete()
          .in("venta_id", ventaIds)
        await supabase
          .from("ventas_detalle")
          .delete()
          .in("venta_id", ventaIds)
      }
      if (devolucionIds.length > 0) {
        await supabase
          .from("devoluciones_detalle")
          .delete()
          .in("devolucion_id", devolucionIds)
      }

      await supabase.from("pagos").delete().eq("cliente_id", clienteId)
      await supabase.from("devoluciones").delete().eq("cliente_id", clienteId)
      await supabase.from("saldos_favor").delete().eq("cliente_id", clienteId)

      if (ventaIds.length > 0) {
        await supabase.from("ventas").delete().in("id", ventaIds)
      }
      if (lineaIds.length > 0) {
        await supabase.from("lineas_credito").delete().in("id", lineaIds)
      }

      // 4. Finally delete the client
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId)
      if (error) throw error

      return { clienteId }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] })
      queryClient.invalidateQueries({ queryKey: ["ventas"] })
      queryClient.invalidateQueries({ queryKey: ["pagos"] })
      queryClient.invalidateQueries({ queryKey: ["lineas_credito_activas"] })
      toast.success("Cliente eliminado exitosamente")
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar cliente"
      ),
  })
}
