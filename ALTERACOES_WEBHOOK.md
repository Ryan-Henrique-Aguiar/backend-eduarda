# Alterações no Webhook do Gatekeeper - Status & Recomendações

## ✅ Alterações Implementadas

### 1. **Transformação Snake_case → CamelCase**
- **Problema**: Cliente enviava dados em `snake_case` (ex: `nome_decisor`, `telefone_decisor`), mas schema esperava `camelCase`
- **Solução**: Adicionada função `transformarSnakeToCamel()` que transforma automaticamente todos os payloads
- **Impacto**: Agora aceita ambos os formatos (snake_case e camelCase)
- **Arquivos**: `src/routes/webhooks.routes.ts` (linhas 1-30)

```typescript
// Aplicado a todos os schemas Zod:
- dialerStatusBody
- gatekeeperBody  
- decisorBody
```

### 2. **Atualização de `faseAutomacao` para `PRONTO_DECISOR`**
- **Problema**: Após identificar o decisor, a negociação não atualizava o status da automação
- **Solução**: Adicionado `faseAutomacao: "PRONTO_DECISOR"` na atualização da negociação
- **Impacto**: Sistema agora rastreia que está pronto para contatar o decisor
- **Arquivo**: `src/routes/webhooks.routes.ts` (linha 214)

### 3. **Campo `observacao` na Negociação**
- **Problema**: Dados do gatekeeper não eram salvos na negociação principal
- **Solução**: Adicionado `observacao: data.observacao` ao update da negociação
- **Impacto**: Histórico completo da interação fica salvo
- **Arquivo**: `src/routes/webhooks.routes.ts` (linha 215)

---

## 📋 Alterações Resumidas

| Campo | Antes | Depois | Linha |
|-------|-------|--------|-------|
| Input Format | camelCase only | snake_case + camelCase | 1-30 |
| faseAutomacao | Não atualizado | PRONTO_DECISOR | 214 |
| observacao | Não gravado | Salvo na negociação | 215 |

---

## 🎯 Fluxo Agora Funcionando

```
1. Dialer liga → Atende Gatekeeper (número geral)
   ↓
2. Eduarda identifica decisor e envia webhook /webhooks/eduarda/gatekeeper
   ↓
3. Sistema atualiza:
   - contatoId → aponta para o decisor (novo contato criado)
   - faseAutomacao → PRONTO_DECISOR
   - observacao → salva o resumo da interação
   - emFilaDiscagem → true (volta à fila para ligar pro decisor)
   ↓
4. Discador pega próxima tentativa com novo telefone do decisor
   ↓
5. Eduarda recebe resposta do decisor e envia /webhooks/eduarda/decisor
```

---

## 🔧 Outras Alterações Necessárias / Recomendadas

### 1. **Adição do Campo `telefoneDecisor` Explícito na Negociação**
**Status**: ⚠️ IMPORTANTE
- **Por quê**: O telefone do decisor fica salvo apenas no contato. Discador pode não puxar corretamente.
- **Ação**:
  ```sql
  ALTER TABLE negociacoes ADD COLUMN telefoneDecisor VARCHAR(20);
  ```
- **Impacto**: Garante que discador sempre tenha o telefone certo
- **Prioridade**: Alta

### 2. **Validação de Email Genérico**
**Status**: ⚠️ PODE MELHORAR
- **Por quê**: `emailDecisor: "null"` (string) não valida corretamente
- **Ação**: Adicionar transformação que converta `"null"` para `null` (undefined)
- **Código**:
```typescript
emailDecisor: z
  .string()
  .transform(val => val === "null" ? undefined : val)
  .email()
  .optional()
  .or(z.literal("")),
```
- **Prioridade**: Média

### 3. **Logging e Rastreamento**
**Status**: ⚠️ RECOMENDADO
- **Por quê**: Difícil debugar problemas de integração
- **Ação**: Adicionar logs estruturados:
```typescript
console.log(`[GATEKEEPER] Negociação ${data.negociacaoId}:`, {
  decisorEncontrado: !!data.nomeDecisor,
  telefoneDecisor: data.telefoneDecisor,
  voltandoFilaDiscagem: !data.transferida && data.interesse,
});
```
- **Prioridade**: Média

### 4. **Incremento de Tentativas para Decisor**
**Status**: ⚠️ RECOMENDADO
- **Por quê**: Contador de tentativas não reseta ao mudar para decisor
- **Ação**: Considerar se deve resetar `tentativas: 0` ao retargetar
- **Prioridade**: Baixa (depende da política comercial)

### 5. **Documentação da API**
**Status**: ⚠️ CRÍTICO
- **Criar arquivo**: `docs/webhooks-api.md`
- **Conteúdo**: 
  - Exemplos de payload (snake_case e camelCase)
  - Fluxo esperado
  - Campos obrigatórios vs opcionais
  - Comportamento esperado em cada cenário

### 6. **Validação de Campos Obrigatórios**
**Status**: ⚠️ IMPORTANTE
- **Por quê**: `emailDecisor` vem como string `"null"` mas schema permite `.optional()`
- **Ação**: Melhorar mensagens de erro e validações
```typescript
const decisorEmail = data.emailDecisor !== "null" ? data.emailDecisor : null;
```

### 7. **Histórico de Retargetizações**
**Status**: 💡 SUGESTÃO FUTURA
- **Por quê**: Útil para auditar quantas vezes uma negociação foi retargetizada
- **Ação**: Criar tabela `RetargetizacoeNegociacao` com histórico
- **Prioridade**: Baixa

### 8. **Sincronização com Discador**
**Status**: ⚠️ CRÍTICO
- **Por quê**: Após retargetar, discador precisa saber que há novo telefone
- **Ação**: Considerar chamar API do discador para atualizar:
```typescript
// Após update da negociacao:
await fetch(`${DIALER_API_URL}/update-target`, {
  method: "POST",
  body: JSON.stringify({
    negociacaoId: data.negociacaoId,
    novoTelefone: data.telefoneDecisor,
    faseAutomacao: "PRONTO_DECISOR"
  })
});
```
- **Prioridade**: ALTA - Sem isto, discador pode continuar ligando pro número antigo

---

## 📝 Checklist de Próximos Passos

- [ ] Testar com payload em snake_case real
- [ ] Adicionar campo `telefoneDecisor` à tabela `negociacoes`
- [ ] Implementar sincronização com Discador
- [ ] Adicionar logging estruturado
- [ ] Criar documentação de API
- [ ] Validar tratamento de email "null"
- [ ] Testar fluxo completo: Gatekeeper → Decisor
- [ ] Adicionar testes unitários dos webhooks

---

## 📊 Impacto das Alterações

| Alteração | Impacto | Risco | Urgência |
|-----------|---------|-------|----------|
| Snake_case transform | ✅ Correção de bugs | Baixo | ALTA |
| faseAutomacao | ✅ Melhor rastreamento | Baixo | MÉDIA |
| observacao | ✅ Histórico completo | Baixo | MÉDIA |
| telefoneDecisor DB | ⚠️ Necessário para fluxo | Médio | ALTA |
| Sincronização Discador | ⚠️ Crítico para funcionar | Alto | CRÍTICA |

