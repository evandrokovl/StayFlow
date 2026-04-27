const { z } = require('zod');
const { emptyQuery } = require('./commonSchemas');

const optionalSubject = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().trim().max(255, 'subject muito longo').nullable()
);

const messageTemplateBodySchema = z.object({
  name: z.string().trim().min(1, 'name e obrigatorio').max(150, 'name muito longo'),
  channel: z.enum(['email', 'whatsapp']).optional().default('email'),
  subject: optionalSubject,
  body: z.string().trim().min(1, 'body e obrigatorio').max(5000, 'body muito longo')
});

const messageTemplateCreateSchema = z.object({
  body: messageTemplateBodySchema,
  params: z.object({}),
  query: emptyQuery
});

const messageTemplateUpdateSchema = z.object({
  body: messageTemplateBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive('id invalido')
  }),
  query: emptyQuery
});

module.exports = {
  messageTemplateCreateSchema,
  messageTemplateUpdateSchema
};
