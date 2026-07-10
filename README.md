# CRM Eduarda — Backend

Backend do CRM próprio para orquestrar a discagem ativa da Eduarda (SDR),
integrado com n8n (Dialer) e as tools do agente de voz.

## Stack

- Node.js + TypeScript
- Fastify (HTTP)
- Prisma + Postgres (Supabase)
- Zod (validação)
- JWT (login do painel) + API key (rotas de serviço)

## Setup

```bash
npm install
cp .env.example .env
# preencha DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, SERVICE_API_KEY

npx prisma migrate dev --name init
npm run prisma:seed   # cria o usuário admin a partir do .env

npm run dev            # http://localhost:3333
```

## Autenticação

Existem **dois mecanismos separados**, de propósito:

1. **JWT (login humano)** — usado pelo painel. Obtido em `POST /auth/login`
   com e-mail/senha do admin. Enviar depois como
   `Authorization: Bearer <token>`.

2. **API key (serviço)** — usada por n8n, Dialer e pela Eduarda. Enviar
   como header `x-api-key: <SERVICE_API_KEY>`. Nunca reutilize o JWT
   humano para isso, e nunca coloque a API key no código do frontend.

Rotas afetadas por cada mecanismo:

| Grupo de rotas         | Autenticação      |
|--------------------------|-------------------|
| `/auth/*`                 | pública (login) / JWT (`/auth/me`) |
| `/negociacoes`, `/empresas`, `/contatos`, `/tarefas`, `/dashboard/*` | JWT |
| `/discagem/*`             | API key |
| `/webhooks/*`             | API key |

## Segurança implementada

- Senha do admin com **bcrypt** (nunca texto puro, custo 12)
- **Rate limit** dedicado no `/auth/login` (5 tentativas/minuto)
- **Rate limit** geral (100 req/min) em toda a API
- **Helmet** (headers de segurança padrão)
- **CORS** restrito ao domínio do painel (configurável via `CORS_ORIGIN`)
- Comparação de API key em **tempo constante** (evita timing attack)
- Logger nunca grava `Authorization` nem `x-api-key` (redact configurado)
- Todo input de rota validado com **Zod** antes de tocar o banco

## Próximos passos sugeridos

- Trocar o BullMQ/agendador do lado do n8n (ou mover para o backend, se
  decidir tirar o n8n do caminho crítico depois)
- Adicionar testes de integração nas rotas de webhook (são as mais
  sensíveis, pois recebem dado de fora)
- Adicionar HTTPS/reverse proxy (Railway/Fly.io já cuidam disso por padrão)
