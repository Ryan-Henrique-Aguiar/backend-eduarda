#!/usr/bin/env bash
# Exemplos prontos para testar a API do CRM Eduarda no Insomnia ou curl.
# Ajuste BASE_URL, API_KEY, JWT_TOKEN e os IDs de exemplo antes de usar.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3333}"
API_KEY="${API_KEY:-SUA_API_KEY_AQUI}"
JWT_TOKEN="${JWT_TOKEN:-SEU_JWT_AQUI}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@exemplo.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-sua_senha}"

EXAMPLE_NEGOCIACAO_ID="${EXAMPLE_NEGOCIACAO_ID:-00000000-0000-0000-0000-000000000000}"
EXAMPLE_EMPRESA_ID="${EXAMPLE_EMPRESA_ID:-00000000-0000-0000-0000-000000000000}"
EXAMPLE_CONTATO_ID="${EXAMPLE_CONTATO_ID:-00000000-0000-0000-0000-000000000000}"
EXAMPLE_TAREFA_ID="${EXAMPLE_TAREFA_ID:-00000000-0000-0000-0000-000000000000}"

# ----------------------
# Health
# ----------------------

curl --location --request GET "$BASE_URL/health"

# ----------------------
# Auth
# ----------------------

curl --location --request POST "$BASE_URL/auth/login" \
  --header "Content-Type: application/json" \
  --data "{\"email\": \"$ADMIN_EMAIL\", \"senha\": \"$ADMIN_PASSWORD\"}"

curl --location --request GET "$BASE_URL/auth/me" \
  --header "Authorization: Bearer $JWT_TOKEN"

# ----------------------
# CRM - Negociações
# ----------------------

curl --location --request GET "$BASE_URL/negociacoes?page=1&pageSize=20" \
  --header "Authorization: Bearer $JWT_TOKEN"

curl --location --request GET "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID" \
  --header "Authorization: Bearer $JWT_TOKEN"

curl --location --request POST "$BASE_URL/negociacoes" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data "{\"empresaId\": \"$EXAMPLE_EMPRESA_ID\", \"contatoId\": \"$EXAMPLE_CONTATO_ID\", \"origem\": \"ATIVA\"}"

curl --location --request PATCH "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "etapa": "QUALIFICADO",
    "observacao": "Atualizando observação via teste",
    "nivelInteresse": "MEDIO"
  }'

# PATCH com API Key (atualizar qualquer campo)
curl --location --request PATCH "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "etapa": "QUALIFICADO",
    "observacao": "Atualizado via API Key",
    "nivelInteresse": "ALTO",
    "faseAutomacao": "PRONTO_DECISOR",
    "dorIdentificada": "Comunicação interna",
    "objecaoPrincipal": "Orçamento"
  }'

# PATCH com API Key (atualizar proximaTentativaPermitida diretamente)
curl --location --request PATCH "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "proximaTentativaPermitida": "2026-07-25T10:00:00.000Z"
  }'

# PATCH com API Key (desativar da fila de discagem)
curl --location --request PATCH "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "emFilaDiscagem": false,
    "observacao": "Removido da fila automaticamente"
  }'

# ----------------------
# CRM - Adiar Tentativa (API Key)
# ----------------------

# Adiar 1 dia
curl --location --request POST "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID/adiar-tentativa" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "delay": "1d"
  }'

# Adiar 2 horas
curl --location --request POST "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID/adiar-tentativa" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "delay": "2h"
  }'

# Adiar 30 minutos
curl --location --request POST "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID/adiar-tentativa" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "delay": "30m"
  }'

# Adiar 3 dias (com JWT Token)
curl --location --request POST "$BASE_URL/negociacoes/$EXAMPLE_NEGOCIACAO_ID/adiar-tentativa" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "delay": "3d"
  }'

# ----------------------
# CRM - Leads
# ----------------------

curl --location --request POST "$BASE_URL/leads" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "empresa": {
      "nome": "Empresa Teste",
      "telefonePrincipal": "+5511999999999",
      "dominioEmail": "empresa.teste"
    },
    "contato": {
      "nome": "Contato Teste",
      "cargo": "Decisor",
      "email": "contato@empresa.teste",
      "telefone": "+5511999999999",
      "ehGatekeeper": false,
      "ehDecisor": true
    },
    "negociacao": {
      "origem": "ATIVA",
      "faseAutomacao": "PRONTO_GATEKEEPER",
      "nivelInteresse": "MEDIO",
      "observacaoInicial": "Lead criado pelo exemplo do Insomnia"
    }
  }'

# ----------------------
# CRM - Empresas
# ----------------------

curl --location --request GET "$BASE_URL/empresas?busca=empresa" \
  --header "Authorization: Bearer $JWT_TOKEN"

curl --location --request POST "$BASE_URL/empresas" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "nome": "Empresa Teste",
    "telefonePrincipal": "+5511999999999",
    "dominioEmail": "empresa.teste"
  }'

curl --location --request GET "$BASE_URL/empresas/$EXAMPLE_EMPRESA_ID" \
  --header "Authorization: Bearer $JWT_TOKEN"

# ----------------------
# CRM - Contatos
# ----------------------

curl --location --request POST "$BASE_URL/contatos" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "empresaId": "'$EXAMPLE_EMPRESA_ID'",
    "nome": "Contato Teste",
    "cargo": "Decisor",
    "email": "contato@empresa.teste",
    "telefone": "+5511999999999",
    "ehGatekeeper": false,
    "ehDecisor": true
  }'

curl --location --request PATCH "$BASE_URL/contatos/$EXAMPLE_CONTATO_ID" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "nome": "Contato Atualizado",
    "cargo": "Decisor Atualizado",
    "email": "novo@empresa.teste",
    "telefone": "+5511988888888",
    "naoLigarNovamente": false,
    "consentimentoLigacao": true
  }'

# ----------------------
# CRM - Tarefas
# ----------------------

curl --location --request GET "$BASE_URL/tarefas?status=PENDENTE" \
  --header "Authorization: Bearer $JWT_TOKEN"

curl --location --request PATCH "$BASE_URL/tarefas/$EXAMPLE_TAREFA_ID" \
  --header "Content-Type: application/json" \
  --header "Authorization: Bearer $JWT_TOKEN" \
  --data '{
    "status": "CONCLUIDA"
  }'

# ----------------------
# CRM - Dashboard
# ----------------------

curl --location --request GET "$BASE_URL/dashboard/resumo" \
  --header "Authorization: Bearer $JWT_TOKEN"

# ----------------------
# Discagem (API key)
# ----------------------

curl --location --request GET "$BASE_URL/discagem/fila-elegivel?limite=50" \
  --header "x-api-key: $API_KEY"

curl --location --request POST "$BASE_URL/discagem/marcar-enviado" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "negociacaoIds": ["'$EXAMPLE_NEGOCIACAO_ID'"]
  }'

# ----------------------
# Webhooks Dialer / Eduarda (API key)
# ----------------------

curl --location --request POST "$BASE_URL/webhooks/dialer/status" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "negociacaoId": "'$EXAMPLE_NEGOCIACAO_ID'",
    "dialerCallId": "call-123",
    "resultado": "ATENDEU",
    "duracaoSegundos": 45
  }'

curl --location --request POST "$BASE_URL/webhooks/eduarda/gatekeeper" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "negociacaoId": "'$EXAMPLE_NEGOCIACAO_ID'",
    "nomeGatekeeper": "Gatekeeper Teste",
    "nomeEmpresa": "Empresa Teste",
    "telefoneEmpresa": "+5511999999999",
    "nomeDecisor": "Decisor Teste",
    "cargoDecisor": "CEO",
    "telefoneDecisor": "+5511987654321",
    "emailDecisor": "decisor@empresa.teste",
    "solicitouRetorno": false,
    "dataHoraContato": "amanhã de manhã",
    "interesse": true,
    "transferida": true,
    "observacao": "Conversa inicial com o gatekeeper"
  }'

curl --location --request POST "$BASE_URL/webhooks/eduarda/decisor" \
  --header "Content-Type: application/json" \
  --header "x-api-key: $API_KEY" \
  --data '{
    "negociacaoId": "'$EXAMPLE_NEGOCIACAO_ID'",
    "nomeDecisor": "Decisor Teste",
    "cargoDecisor": "CEO",
    "emailDecisor": "decisor@empresa.teste",
    "telefoneDecisor": "+5511987654321",
    "cenarioAtendimento": "Necessidade de comunicação interna",
    "interesse": true,
    "nivelInteresse": "ALTO",
    "aceitouReuniao": false,
    "horarioReuniaoSugerido": "amanhã às 10h",
    "solicitouRetorno": false,
    "resultadoLigacao": "interessado_com_retorno",
    "observacao": "Decisor demonstrou interesse e pediu follow-up",
    "decisorPediuNaoLigarMais": false
  }'
