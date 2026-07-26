import { z } from 'zod'

export const createCustomerSchema = z.object({
  code_customer: z.string().min(1, 'El código del cliente es obligatorio'),
  number_store: z.string().optional().nullable(),
  number_customer: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
})

export const updateCustomerSchema = createCustomerSchema.partial()