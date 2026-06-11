"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Cliente, InsertTables, UpdateTables } from "@/lib/supabase/types"
import { toast } from "sonner"

export type ClienteWithRelations = Cliente & {
  cat_ciudad: { nombre: string } | null
  referido_por: { nombre: string } | null
  creado_por: { nombre: string } | null
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
      const clientes = data as unknown as (Cliente & { cat_ciudad: { nombre: string } | null })[]

      // Resolve creado_por: fetch vendedores and match by auth_user_id
      const { data: vendedores } = await supabase
        .from("vendedores")
        .select("auth_user_id, nombre")
      const vendedorMap = new Map((vendedores ?? []).map((v) => [v.auth_user_id, v.nombre]))

      return clientes.map((c) => ({
        ...c,
        referido_por: c.cliente_referido_id
          ? clientes.find((r) => r.id === c.cliente_referido_id)
            ? { nombre: clientes.find((r) => r.id === c.cliente_referido_id)!.nombre }
            : null
          : null,
        creado_por: c.usuario_id
          ? { nombre: vendedorMap.get(c.usuario_id) ?? null }
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
      let creado_por: { nombre: string } | null = null
      if (cliente.usuario_id) {
        const { data: vendedor } = await supabase
          .from("vendedores")
          .select("nombre")
          .eq("auth_user_id", cliente.usuario_id)
          .maybeSingle()
        if (vendedor) creado_por = { nombre: vendedor.nombre }
      }
      return { ...cliente, referido_por, creado_por }
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

      // Pre-flight checks: verify no active credit or referrals blocking deletion
      const { data: lineaActiva } = await supabase
        .from("lineas_credito")
        .select("id, saldo_total, saldo_pagado")
        .eq("cliente_id", clienteId)
        .eq("estado", "activa")
        .maybeSingle()

      if (lineaActiva) {
        const pendiente = lineaActiva.saldo_total - lineaActiva.saldo_pagado
        throw new Error(
          `No se puede eliminar: el cliente tiene un crédito activo con saldo pendiente de $${pendiente.toFixed(2)}. Liquida o cancela el crédito primero.`
        )
      }

      // Cascade delete in FK order
      const steps = [
        {
          name: "referidos",
          fn: () =>
            supabase
              .from("clientes")
              .update({ cliente_referido_id: null })
              .eq("cliente_referido_id", clienteId),
        },
        {
          name: "cobranza_seguimiento",
          fn: async () => {
            const { data: lineas } = await supabase
              .from("lineas_credito")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (lineas ?? []).map((l) => l.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("cobranza_seguimiento")
              .delete()
              .in("linea_credito_id", ids)
            if (error) throw error
          },
        },
        {
          name: "ventas_historial",
          fn: async () => {
            const { data: ventas } = await supabase
              .from("ventas")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (ventas ?? []).map((v) => v.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("ventas_historial")
              .delete()
              .in("venta_id", ids)
            if (error) throw error
          },
        },
        {
          name: "ventas_detalle",
          fn: async () => {
            const { data: ventas } = await supabase
              .from("ventas")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (ventas ?? []).map((v) => v.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("ventas_detalle")
              .delete()
              .in("venta_id", ids)
            if (error) throw error
          },
        },
        {
          name: "devoluciones_detalle",
          fn: async () => {
            const { data: devoluciones } = await supabase
              .from("devoluciones")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (devoluciones ?? []).map((d) => d.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("devoluciones_detalle")
              .delete()
              .in("devolucion_id", ids)
            if (error) throw error
          },
        },
        {
          name: "pagos",
          fn: () =>
            supabase.from("pagos").delete().eq("cliente_id", clienteId),
        },
        {
          name: "devoluciones",
          fn: () =>
            supabase.from("devoluciones").delete().eq("cliente_id", clienteId),
        },
        {
          name: "saldos_favor",
          fn: () =>
            supabase
              .from("saldos_favor")
              .delete()
              .eq("cliente_id", clienteId),
        },
        {
          name: "ventas",
          fn: async () => {
            const { data: ventas } = await supabase
              .from("ventas")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (ventas ?? []).map((v) => v.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("ventas")
              .delete()
              .in("id", ids)
            if (error) throw error
          },
        },
        {
          name: "lineas_credito",
          fn: async () => {
            const { data: lineas } = await supabase
              .from("lineas_credito")
              .select("id")
              .eq("cliente_id", clienteId)
            const ids = (lineas ?? []).map((l) => l.id)
            if (ids.length === 0) return
            const { error } = await supabase
              .from("lineas_credito")
              .delete()
              .in("id", ids)
            if (error) throw error
          },
        },
      ]

      for (const step of steps) {
        try {
          await step.fn()
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          if (msg.toLowerCase().includes("foreign key constraint")) {
            throw new Error(
              `Error al eliminar ${step.name}: hay datos asociados que impiden la eliminacion. Es posible que falte una tabla en la cascada de eliminacion.`
            )
          }
          throw new Error(`Error al eliminar ${step.name}: ${msg}`)
        }
      }

      // Final: delete the client itself
      const { error } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId)
      if (error) {
        if (error.message.toLowerCase().includes("foreign key constraint")) {
          throw new Error(
            "No se puede eliminar el cliente: aun existen datos asociados. Verifica que todas las relaciones hayan sido eliminadas."
          )
        }
        throw new Error(`Error al eliminar cliente: ${error.message}`)
      }

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
