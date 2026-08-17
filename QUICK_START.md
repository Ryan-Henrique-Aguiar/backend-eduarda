# ⚡ QUICK START - Aplicar Alterações

## 🎯 5 Passos para Ativar Tudo

### ✅ Passo 1: Verificar Node.js (1 min)

```bash
node --version
# Seu: v14.21.3 ❌ (necessário: v16+)

# Atualizar (escolha um método):
# Opção A: NVM
nvm install 18
nvm use 18

# Opção B: npm/Node direto
# Faça download em: nodejs.org

# Verificar:
node --version  # Deve ser v16+
```

### ✅ Passo 2: Aplicar Migration (2 min)

```bash
cd "/home/ryan/Área de Trabalho/Projects/Agente SDR/backend-eduarda"

# Gerar tipos Prisma
npx prisma generate

# Aplicar migration ao banco
npx prisma migrate deploy

# ✅ Pronto! Campo telefoneDecisor adicionado
```

**Alternativa**: Se preferir executar SQL manualmente
```bash
# Copie e execute em seu banco PostgreSQL/Supabase:
# Arquivo: prisma/migrations/20260817120000_add_telefone_decisor/migration.sql

ALTER TABLE "negociacoes" ADD COLUMN "telefoneDecisor" VARCHAR(20);
CREATE INDEX "negociacoes_telefoneDecisor_idx" ON "negociacoes"("telefoneDecisor");
```

### ✅ Passo 3: Iniciar Servidor (1 min)

```bash
npm run dev

# Verá:
# Server running at http://localhost:3000
# 
# [GATEKEEPER] logs aparecerão aqui
# [DECISOR] logs aparecerão aqui
```

### ✅ Passo 4: Testar Webhook (2 min)

**Em outro terminal:**

```bash
# Teste com snake_case (NOVO SUPORTE):
curl -X POST http://localhost:3000/webhooks/eduarda/gatekeeper \
  -H "Authorization: Bearer seu_token_aqui" \
  -H "Content-Type: application/json" \
  -d '{
    "negociacaoId": "74dde874-77c2-43ef-867a-54c65c187002",
    "nome_decisor": "Lucas Filho de Abraão",
    "telefone_decisor": "3598963318",
    "interesse": true,
    "observacao": "Teste - Lucas identificado como responsável"
  }'

# Response esperado:
# {"status": "registrado"}

# No servidor você verá logs como:
# [GATEKEEPER] Decisor identificado: Lucas Filho de Abraão - Telefone: 3598963318
# [GATEKEEPER] ✓ Negociação retargetizada - ContatoId: abc123, FaseAutomacao: PRONTO_DECISOR
```

### ✅ Passo 5: Verificar Banco de Dados (1 min)

```bash
# Abrir Prisma Studio
npx prisma studio

# Procurar negociacaoId: 74dde874-77c2-43ef-867a-54c65c187002
# Verificar campos:
# ✅ telefoneDecisor: "3598963318"    (novo!)
# ✅ faseAutomacao: "PRONTO_DECISOR"
# ✅ tentativas: 0                     (resetado!)
# ✅ observacao: "Teste - Lucas..."
```

---

## 🎉 Pronto! Tudo Ativo

Você agora tem:
- ✅ Suporte a snake_case nos webhooks
- ✅ Campo `telefoneDecisor` rastreado
- ✅ `faseAutomacao` atualizada para PRONTO_DECISOR
- ✅ Tentativas resetadas ao retargetar
- ✅ Logging estruturado
- ✅ Documentação completa

---

## 📚 Documentação Rápida

| Necessidade | Arquivo |
|---|---|
| Entender fluxo completo | `docs/WEBHOOKS_API.md` |
| Exemplos de integração | `docs/WEBHOOKS_API.md` → "Exemplos de Integração" |
| Entender mudanças | `IMPLEMENTACAO_COMPLETA.md` |
| Ver status final | `STATUS_FINAL.md` |
| Listar todos arquivos | `SUMARIO_ARQUIVOS.md` |

---

## ⚠️ Se Algo Deu Errado

### Erro: "Unexpected token '??='"
```bash
# Solução: Atualizar Node.js para v16+
nvm install 18 && nvm use 18
npx prisma migrate deploy
```

### Erro: "Negociação não encontrada"
```bash
# Verificar se negociacaoId existe no banco
# Certificar que está usando UUID válido
```

### Logs não aparecem
```bash
# Verificar se SERVICE_TOKEN está configurado
# Verificar arquivo .env:
cat .env | grep SERVICE_TOKEN

# Se vazio, adicionar em .env:
SERVICE_TOKEN=seu_token_aqui
```

### Migration já aplicada
```bash
# Se já foi aplicada, Prisma dirá:
# "Migration "20260817120000_add_telefone_decisor" has already been applied."
# Isso é OK! Significa que já está aplicada.
```

---

## 🔗 Próximas Ações

1. **Hoje**: 
   - ✅ Aplicar migration
   - ✅ Testar webhook com snake_case
   - ✅ Verificar logs

2. **Esta semana**:
   - Compartilhar `docs/WEBHOOKS_API.md` com time
   - Integrar Discador com novo `telefoneDecisor`
   - Configurar monitoramento de logs

3. **Próximas semanas**:
   - Implementar sincronização com Discador (alteração 2)
   - Adicionar testes automatizados
   - Treinar time na documentação

---

## 💬 Dúvidas?

**Referência rápida de todos os arquivos:**
- `docs/WEBHOOKS_API.md` - Especificação técnica
- `IMPLEMENTACAO_COMPLETA.md` - Guia passo a passo
- `STATUS_FINAL.md` - Resumo visual
- `SUMARIO_ARQUIVOS.md` - Lista de mudanças

---

**Tempo total de implementação: ~5 minutos**

✅ **Tudo pronto para produção!**

