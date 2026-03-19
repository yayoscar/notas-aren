import { z } from "zod"

export const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  nombre_contacto: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email("Email inválido").nullable().optional().or(z.literal("")),
  notas: z.string().nullable().optional(),
})

export type ProveedorFormValues = z.infer<typeof proveedorSchema>
