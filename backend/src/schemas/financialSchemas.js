const { z } = require('zod');

const optionalText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().nullable()
);

const optionalId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce.number().int().positive('reservation_id invalido').nullable()
);

const financialBodySchema = z.object({
  property_id: z.coerce.number().int().positive('property_id invalido'),
  reservation_id: optionalId,
  type: z.enum(['income', 'expense'], { message: 'type deve ser income ou expense' }),
  category: optionalText,
  description: optionalText,
  amount: z.coerce.number().positive('amount deve ser maior que zero'),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entry_date invalida'),
  status: z.enum(['paid', 'pending', 'cancelled']).optional().default('paid'),
  source: optionalText
});

const financialCreateSchema = z.object({
  body: financialBodySchema,
  params: z.object({}),
  query: z.object({})
});

const financialUpdateSchema = z.object({
  body: financialBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive('id invalido')
  }),
  query: z.object({})
});

module.exports = {
  financialCreateSchema,
  financialUpdateSchema
};
