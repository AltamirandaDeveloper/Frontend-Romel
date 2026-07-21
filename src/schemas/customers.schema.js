import { z } from 'zod'

export const createCustomerSchema = z.object({
  number_store: z.string().trim().min(1, 'El número de tienda es obligatorio'),
  number_customer: z.string().trim().min(1, 'El número de cliente / RIF es obligatorio'),
  code_customer: z.string().trim().min(2, 'El código del cliente es obligatorio'),
  phone: z.string().trim().optional().or(z.literal('')),
  id_mall: z.union([z.string(), z.number()]).refine((value) => String(value).length > 0, {
    message: 'Debe seleccionar un centro comercial',
  }),
})

export const updateCustomerSchema = createCustomerSchema.partial()
