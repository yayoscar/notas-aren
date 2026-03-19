import { z } from "zod"

export const vendedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  telefono: z.string().min(1, "El teléfono es requerido"),
  usuario: z.string().min(3, "Mínimo 3 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guion bajo"),
  rol: z.enum(["admin", "vendedor"]),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

export const vendedorEditSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  telefono: z.string().min(1, "El teléfono es requerido"),
  rol: z.enum(["admin", "vendedor"]),
})

export type VendedorFormValues = z.infer<typeof vendedorSchema>
export type VendedorEditFormValues = z.infer<typeof vendedorEditSchema>
