import { z } from 'zod'

export const createInventorySchema = z.object({
  code_bar: z.string().trim().min(3, 'El código de barras es obligatorio'),
  model_name: z.string().trim().min(3, 'El nombre del modelo es obligatorio y debe tener al menos 3 caracteres'),
  investment_cost: z.coerce.number({ invalid_type_error: 'El costo de inversión debe ser un número' }).min(0, 'El costo de inversión no puede ser negativo'),
  sale_price: z.coerce.number({ invalid_type_error: 'El precio de venta debe ser un número' }).min(0, 'El precio de venta no puede ser negativo'),
  total_stock: z.coerce.number({ invalid_type_error: 'El stock total debe ser un número' })
    .int('El stock total debe ser un número entero')
    .min(0, 'El stock total no puede ser negativo'),
})

export const updateInventorySchema = createInventorySchema.partial()
