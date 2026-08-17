# Webhooks API - Documentação Completa

## Visão Geral

Os webhooks integram o sistema de discagem (Dialer) com o agente de IA (Eduarda) e o CRM. Eles rastreiam o fluxo completo de uma negociação desde a ligação inicial até o resultado final.

---

## 🔐 Autenticação

Todos os webhooks requerem autenticação de serviço:

```bash
Header: Authorization: Bearer <SERVICE_TOKEN>
```

Implementada via plugin `fastify.authenticateService` em `src/plugins/auth.ts`

---

## 📍 Endpoints

### 1️⃣ POST `/webhooks/dialer/status`

Recebe o status de cada tentativa de ligação realizada pelo Dialer.

#### Request Body

```typescript
{
  "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",  // UUID obrigatório
  "dialerCallId": "call_123456",                             // ID da chamada no Dialer (opcional)
  "resultado": "ATENDEU",                                     // Enum obrigatório
  "duracaoSegundos": 180                                      // Duração em segundos (opcional)
}
```

#### Valores Válidos de `resultado`

- `ATENDEU` - Pessoa atendeu a ligação
- `NAO_ATENDEU` - Ninguém atendeu (enviar para fila com backoff)
- `OCUPADO` - Linha ocupada (backoff mais curto)
- `CAIU` - Ligação caiu (backoff médio)
- `NUMERO_INVALIDO` - Número não existe (não retenta tão cedo)
- `CAIXA_POSTAL` - Caiu na caixa postal (backoff longo)

#### Regra de Backoff

```typescript
// Tempo até próxima tentativa (em horas)
NAO_ATENDEU    → 2 horas + incremento
OCUPADO        → 1 hora + incremento
CAIU           → 4 horas + incremento
CAIXA_POSTAL   → 24 horas + incremento
NUMERO_INVALIDO → 720 horas (30 dias)
```

#### Response

```typescript
// Se conseguiu discar novamente
{
  "status": "reagendado"
}

// Se esgotou tentativas
{
  "status": "esgotado"
}

// Se atendeu (aguarda conversa com Eduarda)
{
  "status": "aguardando_conversa_eduarda"
}
```

#### Estados da Negociação Após

| Resultado | emFilaDiscagem | Etapa | Próxima |
|-----------|---|---|---|
| ATENDEU | false | PROSPECCAO | Aguarda webhook Eduarda |
| NAO_ATENDEU | true | PROSPECCAO | Retenta no intervalo |
| OCUPADO | true | PROSPECCAO | Retenta no intervalo |
| NUMERO_INVALIDO | false | PERDIDO | Não retenta |
| Esgotou tentativas | false | PERDIDO | Não retenta |

---

### 2️⃣ POST `/webhooks/eduarda/gatekeeper`

Recebe dados da conversa com o gatekeeper/recepcionista. É aqui que **o decisor é identificado**.

#### Request Body

Aceita tanto **snake_case** quanto **camelCase**:

```typescript
// Formato snake_case (recomendado pela Eduarda)
{
  "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
  "nome_gatekeeper": "Ryan",
  "nome_empresa": "Juniores",
  "telefone_empresa": "35998270245",
  "nome_decisor": "Lucas Filho de Abraão",
  "cargo_decisor": "Desenvolvedor / Tech Lead",
  "telefone_decisor": "3598963318",                    // ✅ Crítico: é salvo em negociacao.telefoneDecisor
  "email_decisor": "lucas@juniores.com",
  "solicitou_retorno": false,
  "data_hora_contato": null,
  "interesse": true,                                   // Se há abertura
  "transferida": false,                                // Se já transferiu pro decisor agora
  "observacao": "Ryan informou que Lucas Filho de Abraão, desenvolvedor da área de tecnologia, é o responsável pelo assunto e passou o telefone direto para contato."
}

// OU formato camelCase (também aceito)
{
  "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
  "nomeGatekeeper": "Ryan",
  "nomeEmpresa": "Juniores",
  "telefoneEmpresa": "35998270245",
  "nomeDecisor": "Lucas Filho de Abraão",
  "cargoDecisor": "Desenvolvedor / Tech Lead",
  "telefoneDecisor": "3598963318",
  "emailDecisor": "lucas@juniores.com",
  "solicitouRetorno": false,
  "dataHoraContato": null,
  "interesse": true,
  "transferida": false,
  "observacao": "Ryan informou que Lucas Filho de Abraão..."
}
```

#### Campos Obrigatórios

- `negociacaoId` - UUID da negociação
- `interesse` - boolean (há abertura para conversa)
- `observacao` - string com resumo (min 1 caractere)

#### Campos Recomendados (quando decisor identificado)

- `nomeDecisor` - Nome completo
- `telefoneDecisor` - Telefone direto ✅ CRÍTICO
- `cargoDecisor` - Posição/cargo
- `emailDecisor` - Email (pode ser vazio ou "null")
- `telefoneEmpresa` - Telefone geral

#### Response

```typescript
{
  "status": "registrado"
}
```

#### Estados da Negociação Após

| Cenário | faseAutomacao | contatoId | emFilaDiscagem | tentativas | observacao |
|---------|---|---|---|---|---|
| Decisor identificado + interesse | PRONTO_DECISOR | novo decisor | true | **0** (resetado) | salvo |
| Decisor identificado + transferida | PRONTO_DECISOR | novo decisor | false | **0** | salvo |
| Sem decisor + sem interesse | N/A | ~~sem mudança~~ | false | ~~sem mudança~~ | salvo |

#### Fluxo Esperado

```
1. Gatekeeper identifica decisor ✓
   ├─ Cria/atualiza contato do decisor
   ├─ Salva telefone do decisor em negociacao.telefoneDecisor
   ├─ Muda faseAutomacao para PRONTO_DECISOR
   ├─ Reseta tentativas para 0
   └─ Volta à fila com novo contato

2. Discador pega da fila
   ├─ Usa negociacao.contatoId (novo decisor)
   ├─ Usa negociacao.telefoneDecisor
   └─ Liga pro decisor

3. Eduarda conversa com decisor
   └─ Envia webhook decisor
```

---

### 3️⃣ POST `/webhooks/eduarda/decisor`

Recebe resultado da conversa com o decisor. **É o resultado final** da negociação.

#### Request Body

Também aceita snake_case e camelCase:

```typescript
{
  "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
  "nome_decisor": "Lucas Filho de Abraão",
  "cargo_decisor": "Desenvolvedor / Tech Lead",
  "email_decisor": "lucas@juniores.com",
  "telefone_decisor": "3598963318",
  "cenario_atendimento": "Empresa com 15 pessoas, ainda usando sistemas legados",
  "interesse": true,
  "nivel_interesse": "ALTO",                           // Enum: ALTO, MEDIO, BAIXO, SEM_INTERESSE
  "aceitou_reuniao": true,
  "horario_reuniao_sugerido": "15/08/2026 às 14h",    // Texto livre
  "solicitou_retorno": false,
  "resultado_ligacao": "reuniao_aceita",               // Texto livre para controle interno
  "decisor_pediu_nao_ligar_mais": false,
  "observacao": "Interessado em avaliar solução. Reunião marcada para conhecer melhor. Mencionou que tem orçamento liberado Q3."
}
```

#### Campos Obrigatórios

- `negociacaoId` - UUID da negociação
- `nomeDecisor` - Nome completo (min 1 caractere)
- `interesse` - boolean
- `nivelInteresse` - ALTO | MEDIO | BAIXO | SEM_INTERESSE
- `aceitouReuniao` - boolean
- `resultadoLigacao` - string descritiva
- `observacao` - string (min 1 caractere)

#### Estados da Negociação Após

| Resultado | Etapa | emFilaDiscagem | nivelInteresse |
|-----------|---|---|---|
| Aceitou reunião | REUNIAO_MARCADA | false | ALTO/MEDIO/BAIXO |
| Sem interesse | SEM_INTERESSE | false | SEM_INTERESSE |
| Interesse com retorno | QUALIFICADO | false | ALTO/MEDIO |

#### Response

```typescript
{
  "status": "registrado",
  "etapa": "REUNIAO_MARCADA"  // Nova etapa
}
```

#### Fluxo de Tarefas Criadas

```typescript
// Se aceitou reunião
{
  tipo: "reuniao",
  descricao: "Reunião sugerida: 15/08/2026 às 14h"
}

// Se solicitou retorno
{
  tipo: "retorno",
  descricao: "Retorno solicitado: horário a combinar"
}

// Se sem interesse + sem retorno
// Nenhuma tarefa
```

---

## 🔄 Fluxo Completo de Uma Negociação

```
┌─────────────────────────────────────────────────────────────┐
│ PROSPECCAO (Inicial)                                         │
│ faseAutomacao: BACKLOG                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │ DIALER tenta ligar     │
        │ /webhooks/dialer/status│
        └────────────────────────┘
                     │
        ┌────────────┴──────────────┬──────────────────┐
        │                           │                  │
        ▼                           ▼                  ▼
    NAO_ATENDEU              ATENDEU            NUMERO_INVALIDO
    Retentar em 2h           ↓                  ↓
    ↓                        Aguarda            PERDIDO
    Fila de novo             Eduarda            (não retentar)


        ┌──────────────────────────────────────────────────────┐
        │ GATEKEEPER (Recepção atende)                         │
        │ /webhooks/eduarda/gatekeeper                         │
        │ ✓ Identifica decisor                                 │
        │ ✓ Salva telefoneDecisor                              │
        │ ✓ Muda faseAutomacao: PRONTO_DECISOR                 │
        │ ✓ Reseta tentativas: 0                               │
        └─────────────────┬──────────────────────────────────┘
                          │
                          ▼
             ┌────────────────────────┐
             │ DIALER tenta ligar     │
             │ para o DECISOR         │
             │ (novo telefone)        │
             └────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────────────────────┐
        │ DECISOR (Gerente/Dono atende)                        │
        │ /webhooks/eduarda/decisor                            │
        │ ✓ Registra resultado final                           │
        │ ✓ Move para REUNIAO_MARCADA ou SEM_INTERESSE         │
        │ ✓ Para de discar (emFilaDiscagem: false)             │
        └──────────────────────────────────────────────────────┘
                          │
             ┌────────────┴─────────────┐
             │                          │
             ▼                          ▼
        REUNIAO_MARCADA             SEM_INTERESSE
        (para o time)               (encerra)
```

---

## 📊 Estados e Transições

### Etapas (etapa)

```typescript
enum EtapaNegociacao {
  PROSPECCAO        // Ainda tentando ligar
  EM_LIGACAO        // Dialer está tentando agora
  QUALIFICADO       // Há interesse e possibilidade de venda
  REUNIAO_MARCADA   // Reunião confirmada
  SEM_INTERESSE     // Recusou
  PERDIDO           // Esgotou tentativas
  GANHO             // Cliente (uso futuro)
}
```

### Fases de Automação (faseAutomacao)

```typescript
enum FaseAutomacao {
  BACKLOG                 // Novo, não processado
  PRONTO_GATEKEEPER       // Pronto para primeira ligação
  EM_CONTATO_GATEKEEPER   // Gatekeeper identificado
  PRONTO_DECISOR          // Pronto para ligar pro decisor
  EM_CONTATO_DECISOR      // Conversando com decisor
  FINALIZADO              // Conversa finalizada
}
```

---

## 🐛 Logs Estruturados

O sistema registra logs em formato estruturado para debugging:

```bash
[GATEKEEPER] Iniciando processamento - NegociacaoId: 74dde874-77c2-43ef-867a-54c65c187002
{
  "nomeDecisor": "Lucas Filho de Abraão",
  "telefoneDecisor": "3598963318",
  "interesse": true,
  "transferida": false
}

[GATEKEEPER] Decisor identificado: Lucas Filho de Abraão - Telefone: 3598963318

[GATEKEEPER] ✓ Negociação retargetizada - ContatoId: abc123xyz, FaseAutomacao: PRONTO_DECISOR

[GATEKEEPER] ✓ Webhook processado com sucesso - NegociacaoId: 74dde874-77c2-43ef-867a-54c65c187002
```

---

## ⚠️ Tratamento de Erros

### Validação Falha (400)

```json
{
  "error": "Dados inválidos.",
  "detalhes": {
    "fieldErrors": {
      "observacao": ["String must contain at least 1 character"]
    }
  }
}
```

### Negociação Não Encontrada (404)

```json
{
  "error": "Negociação não encontrada."
}
```

### Erro Interno (500)

```json
{
  "error": "Internal server error"
}
```

Verifique os logs estruturados para detalhes:
```bash
[GATEKEEPER] ✗ ERRO ao processar webhook
{
  "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
  "erro": "Unique constraint failed on contato.telefone"
}
```

---

## 🔍 Exemplos de Integração

### cURL - Webhook Gatekeeper

```bash
curl -X POST http://localhost:3000/webhooks/eduarda/gatekeeper \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
    "nome_decisor": "Lucas Filho de Abraão",
    "telefone_decisor": "3598963318",
    "interesse": true,
    "observacao": "Decisor identificado, pronto para contato direto"
  }'
```

### Node.js / Fetch

```typescript
const response = await fetch(
  'http://localhost:3000/webhooks/eduarda/gatekeeper',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      negociacaoId: '74dde874-77c2-43ef-867a-54c65c187002',
      nome_decisor: 'Lucas Filho de Abraão',
      telefone_decisor: '3598963318',
      interesse: true,
      observacao: 'Decisor identificado via gatekeeper',
    }),
  }
);

const data = await response.json();
console.log('Status:', data.status); // "registrado"
```

### Python / Requests

```python
import requests

response = requests.post(
    'http://localhost:3000/webhooks/eduarda/gatekeeper',
    headers={
        'Authorization': f'Bearer {SERVICE_TOKEN}',
        'Content-Type': 'application/json',
    },
    json={
        'negociacaoId': '74dde874-77c2-43ef-867a-54c65c187002',
        'nome_decisor': 'Lucas Filho de Abraão',
        'telefone_decisor': '3598963318',
        'interesse': True,
        'observacao': 'Decisor identificado via gatekeeper',
    },
)

print(response.json())  # {'status': 'registrado'}
```

---

## 📋 Checklist de Integração

- [ ] Autenticação configurada (SERVICE_TOKEN no .env)
- [ ] Dialer envia webhook `/webhooks/dialer/status` após cada tentativa
- [ ] Eduarda envia webhook `/webhooks/eduarda/gatekeeper` após conversa com recepção
- [ ] Eduarda envia webhook `/webhooks/eduarda/decisor` após conversa com decisor
- [ ] Monitorar logs estruturados em produção
- [ ] Verificar que `telefoneDecisor` é salvo corretamente
- [ ] Verificar que tentativas são resetadas ao retargetar
- [ ] Testar fluxo completo ponta a ponta

---

## 🚀 Melhorias Futuras

1. **Retry com backoff exponencial** - Caso webhook falhe
2. **Webhook delivery status** - Rastreio de se webhook foi entregue
3. **Rate limiting por IP** - Proteção contra abuso
4. **Criptografia de dados sensíveis** - Telefone e email
5. **Auditoria completa** - Quem atualizou o quê e quando
6. **Integração com CRM externo** - Sincronização com RD Station ou HubSpot

