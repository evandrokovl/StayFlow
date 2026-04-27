const { z } = require('zod');

const optionalText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().nullable()
);

const optionalUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().url('URL invalida').nullable()
);

const icalFeedSchema = z.object({
  channel: z.string().trim().min(1, 'channel e obrigatorio').max(60, 'channel muito longo').default('other'),
  ical_url: z.string().trim().url('ical_url invalida'),
  is_active: z.boolean().optional().default(true)
});

const propertyBodySchema = z.object({
  name: z.string().trim().min(1, 'name e obrigatorio'),
  description: optionalText,
  address: optionalText,
  city: z.string().trim().min(1, 'city e obrigatorio'),
  state: optionalText,
  country: optionalText,
  airbnb_ical_url: optionalUrl,
  booking_ical_url: optionalUrl,
  ical_feeds: z.preprocess(
    (value) => (value === undefined || value === null || value === '' ? [] : value),
    z.array(icalFeedSchema).max(10, 'Limite de 10 feeds iCal por imovel')
  ).optional(),
  listing_url: z.string().trim().url('listing_url invalida')
});

const propertyCreateSchema = z.object({
  body: propertyBodySchema,
  params: z.object({}),
  query: z.object({})
});

const propertyUpdateSchema = z.object({
  body: propertyBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive('id invalido')
  }),
  query: z.object({})
});

module.exports = {
  propertyCreateSchema,
  propertyUpdateSchema
};
