const { z } = require('zod');

const optionalPropertyId = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? null : value),
  z.coerce.number().int().positive('property_id invalido').nullable()
);

const triggerMap = {
  pre_check_in: 'before_checkin',
  check_in: 'checkin_day',
  during_stay: 'reservation_created',
  check_out: 'checkout_day',
  post_check_out: 'after_checkout'
};

const validTriggers = [
  'reservation_created',
  'before_checkin',
  'checkin_day',
  'before_checkout',
  'checkout_day',
  'after_checkout'
];

const triggerTypeSchema = z.string().trim().transform((value) => triggerMap[value] || value)
  .refine((value) => validTriggers.includes(value), 'trigger_type invalido');

const optionalOffsetValue = z.preprocess(
  (value) => (value === '' || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().optional()
);

const automationBodySchema = z.object({
  property_id: optionalPropertyId,
  template_id: z.coerce.number().int().positive('template_id invalido'),
  name: z.string().trim().min(1, 'name e obrigatorio'),
  trigger_type: triggerTypeSchema,
  trigger_offset_value: optionalOffsetValue,
  offset_days: optionalOffsetValue,
  days_offset: optionalOffsetValue,
  trigger_offset_unit: z.enum(['minutes', 'hours', 'days']).optional().default('days'),
  is_active: z.union([z.boolean(), z.coerce.number().int().min(0).max(1)]).optional().default(1)
}).transform((body) => ({
  property_id: body.property_id,
  template_id: body.template_id,
  name: body.name,
  trigger_type: body.trigger_type,
  trigger_offset_value: body.trigger_offset_value ?? body.offset_days ?? body.days_offset ?? 0,
  trigger_offset_unit: body.trigger_offset_unit,
  is_active: body.is_active
}));

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
