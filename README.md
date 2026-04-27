# StayFlow

StayFlow e um SaaS para gestao de imoveis de aluguel por temporada. O produto centraliza reservas, calendarios iCal, automacoes de mensagens, financeiro, cobranca e billing em uma experiencia web para anfitrioes e pequenas operacoes.

## Stack

- Backend: Node.js, Express 5, MySQL, Redis/BullMQ, Zod, JWT, Helmet, CORS.
- Filas e worker: BullMQ com Redis.
- Integracoes: iCal, inbound email, Resend e Asaas.
- Frontend: HTML, CSS e JavaScript estatico.
- Deploy esperado: Railway para API/worker e Vercel para frontend estatico.

## Estrutura de pastas

```text
backend/
  migrations/          SQLs de evolucao de schema
  scripts/             scripts operacionais e validacoes
  src/
    config/            env, database e Redis
    controllers/       controllers especificos
    middlewares/       auth, validacao, rate limit e erros
    queues/            filas BullMQ
    routes/            rotas HTTP
    schemas/           schemas Zod
    services/          regras de negocio e integracoes
    workers/           processamento assincrono
  test/                testes com node:test
frontend/
  index.html           landing publica principal
  app.html             entrada do painel web
  app/                 CSS e JS do painel
  assets/              imagens e icones publicos
  robots.txt           regras de indexacao
  sitemap.xml          sitemap publico
```

## Como rodar o backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Para producao:

```bash
cd backend
npm start
```

A API usa `PORT` do `.env` e, por padrao local, roda em `http://localhost:3000`.

## Como rodar o worker

```bash
cd backend
npm run worker
```

Para producao:

```bash
cd backend
npm run worker:start
```

O worker depende de Redis e usa as mesmas variaveis de ambiente do backend.

## Como rodar o frontend

O frontend e estatico. Em desenvolvimento, abra `frontend/index.html` para a landing e `frontend/app.html` para o painel.

Tambem e possivel servir a pasta `frontend/` com qualquer servidor estatico. O painel espera a API em `http://localhost:3000` quando aberto em localhost ou via `file://`; em producao ele usa `https://api.stayflowapp.online`, a menos que `window.STAYFLOW_API_URL` seja configurado antes de carregar o app.

## Variaveis de ambiente

Copie `backend/.env.example` para `backend/.env` e preencha conforme o ambiente.

```text
NODE_ENV
PORT
JWT_SECRET
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
DB_SSL_ENABLED
DB_SSL_REJECT_UNAUTHORIZED
APP_BASE_URL
FRONTEND_BASE_URL
INBOUND_DOMAIN
WEBHOOK_SECRET
RESEND_API_KEY
EMAIL_FROM
REDIS_URL
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
REDIS_DB
QUEUE_PREFIX
ASAAS_BASE_URL
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
```

Nunca versione `.env` com credenciais reais.

## Migrations

As migrations SQL ficam em `backend/migrations/`. O comando operacional aplica as evolucoes suportadas pelo backend:

```bash
cd backend
npm run migrate
```

Para inspecionar indices e colunas criticas ja aplicadas:

```bash
cd backend
npm run migrate:verify
```

## Seed demo/teste

Para criar dados ficticios de demonstracao em ambiente local ou teste:

```bash
cd backend
npm run seed:demo
```

O seed cria ou atualiza o usuario `demo@stayflowapp.online`, dois imoveis ficticios, reservas, financeiro, templates e automacoes. O script e idempotente e bloqueia execucao quando `NODE_ENV=production`.

## Testes e checks

```bash
cd backend
npm run check:encoding
npm test
```

Se o runner local ficar aberto por handles assincronos de fila/conexao, valide a suite com:

```bash
cd backend
node --test --test-isolation=none --test-force-exit test/*.test.js
```

Para checar sintaxe JS:

```bash
cd backend
node --check server.js
node --check worker.js
```

No frontend, cheque o app principal:

```bash
node --check frontend/app/app.js
```

## Deploy Railway e Vercel

Backend/API no Railway:

- Configure as variaveis de ambiente do backend.
- Use `npm start` como comando da API.
- Use `npm run worker:start` em um servico separado para o worker.
- Configure MySQL e Redis acessiveis pela API e pelo worker.

Frontend na Vercel:

- Configure `frontend/` como diretorio publico/raiz do projeto estatico.
- A landing publica deve servir `frontend/index.html` em `/`.
- O painel deve servir `frontend/app.html` em `/app.html`.
- `robots.txt` e `sitemap.xml` devem ficar acessiveis em `/robots.txt` e `/sitemap.xml`.

## Fluxo principal do produto

1. Usuario cria conta e acessa o painel.
2. Usuario cadastra um imovel.
3. Usuario conecta calendarios iCal e sincroniza reservas/eventos.
4. Usuario configura o e-mail inbound do StayFlow para receber eventos das plataformas.
5. Usuario cria templates e automacoes de mensagens.
6. Usuario acompanha reservas, calendario, financeiro, mensagens e cobranca no painel.
7. Billing Asaas controla assinatura, pagamentos e status de acesso.

## Observacoes de producao

- Use `JWT_SECRET` forte e exclusivo por ambiente.
- Remova origens CORS desnecessarias em producao.
- Proteja webhooks com segredo/token.
- Monitore API, MySQL, Redis, worker e provedores externos.
- Rode migrations antes de publicar versoes que dependem de schema novo.
- Evite dados reais em seeds, testes e ambientes demo.
- Valide `robots.txt`, `sitemap.xml`, canonical e metadados depois do deploy do frontend.
