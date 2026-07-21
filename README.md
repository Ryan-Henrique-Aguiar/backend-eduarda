# CRM Eduarda — Backend

Backend do CRM próprio para orquestrar a prospecção ativa da Eduarda (SDR),
integrado com o dialer, n8n e as ferramentas do agente de voz.

## O que a API faz

- autentica o painel com JWT e integrações com API key
- gerencia empresas, contatos, negociações, tarefas e resumo do dashboard
- suporta criação de leads em uma transação única
- expõe rotas de discagem e webhooks para o fluxo outbound

## Stack

- Node.js + TypeScript
- Fastify
- Prisma + PostgreSQL
- Zod para validação
- JWT, bcrypt, rate-limit e helmet

## Requisitos

- Node.js 20+
- PostgreSQL acessível via Prisma
- variáveis de ambiente definidas no arquivo .env

## Setup

```bash
npm install
cp .env.exemple .env
# preencha DATABASE_URL, DIRECT_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD e SERVICE_API_KEY

npm run prisma:generate
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

O servidor fica disponível em http://localhost:3333.

## Autenticação

Existem dois mecanismos separados:

1. JWT para o painel humano
   - obtido em POST /auth/login
   - enviado como Authorization: Bearer <token>

2. API key para serviços
   - usada por n8n, dialer e pela Eduarda
   - enviada via header x-api-key: <SERVICE_API_KEY>

Rotas principais por mecanismo:

- /auth/*: pública (login) e JWT em /auth/me
- /negociacoes, /empresas, /contatos, /tarefas, /dashboard/*: JWT
- /discagem/*: API key
- /webhooks/*: API key

Observação: GET /negociacoes/:id aceita tanto JWT quanto API key.

## Endpoints principais

- POST /auth/login
- GET /negociacoes e GET /negociacoes/:id
- POST /negociacoes e PATCH /negociacoes/:id
- POST /leads
- GET /empresas e GET /empresas/:id
- POST /contatos e PATCH /contatos/:id
- GET /tarefas e PATCH /tarefas/:id
- GET /dashboard/resumo
- GET /discagem/fila-elegivel
- POST /discagem/marcar-enviado
- POST /webhooks/dialer/status
- POST /webhooks/eduarda/gatekeeper
- POST /webhooks/eduarda/decisor

## Segurança implementada

- senhas com bcrypt
- rate limit no login e na API
- headers de segurança com helmet
- CORS configurável via CORS_ORIGIN
- redaction de headers sensíveis em logs
- validação de payloads com Zod antes de acessar o banco

## Uso com o Insomnia

O arquivo insomnia-curls.sh traz exemplos prontos para os fluxos de auth, CRM, discagem e webhooks.
