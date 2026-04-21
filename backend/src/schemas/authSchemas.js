const { z } = require('zod');
const { isValidCpf } = require('../utils/cpf');

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Nome e obrigatorio'),
    email: z.string().email('Email invalido'),
    cpf: z.string().min(1, 'CPF e obrigatorio').refine(isValidCpf, 'CPF invalido'),
    password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres')
  }),
  params: z.object({}),
  query: z.object({})
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalido'),
    password: z.string().min(6, 'Senha obrigatoria')
  }),
  params: z.object({}),
  query: z.object({})
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Email invalido')
  }),
  params: z.object({}),
  query: z.object({})
});

const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(32, 'Token invalido'),
    password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres')
  }),
  params: z.object({}),
  query: z.object({})
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};
