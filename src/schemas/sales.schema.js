import { z } from 'zod'

export const deliveryItemSchema = z.object({
  bag_id: z.coerce
    .number({ invalid_type_error: 'Seleccione un bolso válido' })
    .positive('Debe seleccionar un bolso'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Ingrese una cantidad válida' })
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0'),
})

export const createDeliverySchema = z.object({
  id_store: z.coerce
    .number({ invalid_type_error: 'Seleccione un cliente' })
    .positive('Debe seleccionar un cliente registrado'),
  items: z
    .array(deliveryItemSchema)
    .min(1, 'Debe agregar al menos un bolso a la nota de entrega'),
})

export const settlementItemSchema = z
  .object({
    sold: z.coerce
      .number({ invalid_type_error: 'Ingrese un número válido' })
      .int('Debe ser número entero')
      .min(0, 'La cantidad vendida no puede ser negativa'),
    returned: z.coerce
      .number({ invalid_type_error: 'Ingrese un número válido' })
      .int('Debe ser número entero')
      .min(0, 'La cantidad devuelta no puede ser negativa'),
    delivered: z.coerce.number().int().min(1),
  })
  .refine((data) => data.sold + data.returned === data.delivered, {
    message: 'La suma de vendidos y devueltos debe ser EXACTAMENTE igual a la cantidad entregada',
  })

export const createExpenseSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: 'Ingrese un monto válido' })
    .positive('El monto del gasto debe ser mayor a 0'),
  description: z
    .string()
    .trim()
    .min(3, 'La descripción debe tener al menos 3 caracteres'),
})