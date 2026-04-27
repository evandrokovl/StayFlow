const { z } = require('zod');
const { emptyQuery } = require('./commonSchemas');

const activateSubscriptionSchema = z.object({
  body: z.object({
    billingType: z.enum(['PIX', 'BOLETO', 'CREDIT_CARD']).optional().default('PIX')
  }).optional().default({}),
  params: z.object({}),
  query: emptyQuery
});

module.exports = {
  activateSubscriptionSchema
};
