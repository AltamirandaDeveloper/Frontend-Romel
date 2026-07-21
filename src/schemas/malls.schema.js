import { z } from 'zod'

export const createMallSchema = z.object({
  name: z.string().trim().min(3, 'El nombre del centro comercial es obligatorio y debe tener al menos 3 caracteres'),
  address: z.string().trim().min(5, 'La dirección es obligatoria y debe tener al menos 5 caracteres'),
})

export const updateMallSchema = createMallSchema.partial()
