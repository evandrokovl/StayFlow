const { z } = require('zod');

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const reservationTypeEnum = z.enum(['manual', 'blocked', 'maintenance']);

const createReservationSchema = z.object({
  body: z.object({
    property_id: z.coerce.number().int().positive('property_id inválido'),
    guest_name: z.string().trim().max(150).optional().nullable(),
    start_date: z
      .string()
      .regex(dateRegex, 'start_date deve estar no formato YYYY-MM-DD'),
    end_date: z
      .string()
      .regex(dateRegex, 'end_date deve estar no formato YYYY-MM-DD'),
    type: reservationTypeEnum.optional().default('manual'),
    guest_email: z
      .string()
      .trim()
      .email('guest_email inválido')
      .optional()
      .or(z.literal(''))
      .nullable(),
    guest_phone: z
      .string()
      .trim()
      .max(30, 'guest_phone muito longo')
      .optional()
      .or(z.literal(''))
      .nullable(),
    notes: z
      .string()
      .trim()
      .max(2000, 'notes muito longo')
      .optional()
      .or(z.literal(''))
      .nullable(),
    total_amount: z
      .union([
        z.number(),
        z.string(),
        z.null(),
        z.literal('')
      ])
      .optional()
  }),
  params: z.object({}),
  query: z.object({})
}).superRefine((data, ctx) => {
  const { start_date, end_date, type, guest_name } = data.body;

  const start = new Date(`${start_date}T00:00:00`);
  const end = new Date(`${end_date}T00:00:00`);

  if (Number.isNaN(start.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body', 'start_date'],
      message: 'start_date inválida'
    });
  }

  if (Number.isNaN(end.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body', 'end_date'],
      message: 'end_date inválida'
    });
  }

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body', 'end_date'],
      message: 'end_date deve ser maior que start_date'
    });
  }

  if (type === 'manual' && (!guest_name || !String(guest_name).trim())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['body', 'guest_name'],
      message: 'guest_name é obrigatório para reservas manuais'
    });
  }
});

module.exports = {
  createReservationSchema
};
