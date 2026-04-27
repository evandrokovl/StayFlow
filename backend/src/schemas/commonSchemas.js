const { z } = require('zod');

const emptyBody = z.any().optional();
const emptyQuery = z.object({}).passthrough();

const idParamSchema = z.object({
  body: emptyBody,
  params: z.object({
    id: z.coerce.number().int().positive('id invalido')
  }),
  query: emptyQuery
});

module.exports = {
  emptyBody,
  emptyQuery,
  idParamSchema
};
