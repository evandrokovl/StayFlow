const { z } = require('zod');

const optionalText = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().nullable()
);

const optionalUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().url('URL invalida').nullable()
);

const propertyBodySchema = z.object({
  name: z.string().trim().min(1, 'name e obrigatorio'),
  description: optionalText,
  address: optionalText,
  city: z.string().trim().min(1, 'city e obrigatorio'),
  state: optionalText,
  country: optionalText,
  airbnb_ical_url: optionalUrl,
  booking_ical_url: optionalUrl,
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
