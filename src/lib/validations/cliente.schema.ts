import { z } from "zod"

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  telefono: z.string().min(1, "El teléfono es requerido"),
  correo: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  ciudad_id: z.string().min(1, "La ciudad es requerida"),
  direccion: z.string().min(1, "La dirección es requerida"),
  referencia_ubicacion: z.string().min(1, "La referencia es requerida"),
  latitud: z.number().nullable().optional(),
  longitud: z.number().nullable().optional(),
  cliente_referido_id: z.string().nullable().optional(),
})

export type ClienteFormValues = z.infer<typeof clienteSchema>
