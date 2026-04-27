const { z } = require('zod');
const { emptyBody, emptyQuery } = require('./commonSchemas');

const icalFeedSchema = z.object({
  body: emptyBody,
  params: z.object({
    token: z.string().trim().min(6, 'token invalido').max(120, 'token invalido').regex(/^[a-zA-Z0-9_-]+$/, 'token invalido')
  }),
  query: emptyQuery
});

const icalPropertySchema = z.object({
  body: emptyBody,
  params: z.object({
    id: z.string().trim().regex(/^\d+$/, 'id invalido')
  }),
  query: emptyQuery
});

module.exports = {
  icalFeedSchema,
  icalPropertySchema
};
