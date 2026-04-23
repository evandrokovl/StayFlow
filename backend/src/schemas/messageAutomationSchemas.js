const { z } = require('zod');

const optionalPropertyId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce.number().int().positive('property_id invalido').nullable()
);

const automationBodySchema = z.object({
  property_id: optionalPropertyId,
  template_id: z.coerce.number().int().positive('template_id invalido'),
  name: z.string().trim().min(1, 'name e obrigatorio'),
  trigger_type: z.enum([
    'reservation_created',
    'before_checkin',
    'checkin_day',
    'before_checkout',
    'checkout_day',
    'after_checkout'
  ], { message: 'trigger_type invalido' }),
  trigger_offset_value: z.coerce.number().int().optional().default(0),
  trigger_offset_unit: z.enum(['minutes', 'hours', 'days']).optional().default('days'),
  is_active: z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).optional().default(1)
});

const messageAutomationCreateSchema = z.object({
  body: automationBodySchema,
  params: z.object({}),
  query: z.object({})
});

const messageAutomationUpdateSchema = z.object({
  body: automationBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive('id invalido')
  }),
  query: z.object({})
});

module.exports = {
  messageAutomationCreateSchema,
  messageAutomationUpdateSchema
};
