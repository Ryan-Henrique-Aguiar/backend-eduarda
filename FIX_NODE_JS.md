# ⚡ SOLUÇÃO RÁPIDA - Build + Node.js

## 🚨 Problema

Seu ambiente: **Node.js 14** (precisamos **16+**)

```bash
node --version  # Seu: v14.21.3
# Necessário: v16.13+ ou v18+ (recomendado)
```

---

## ✅ Solução (5 minutos)

### Passo 1: Instalar NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### Passo 2: Limpar e Reinstalar

```bash
cd "/home/ryan/Área de Trabalho/Projects/Agente SDR/backend-eduarda"
rm -rf node_modules package-lock.json
npm install
```

### Passo 3: Regenerar Tipos Prisma

```bash
npx prisma generate
```

Isso vai atualizar os tipos TypeScript para incluir o novo campo `telefoneDecisor`.

### Passo 4: Build

```bash
npm run build
# ✅ Sucesso!
```

### Passo 5: Testar

```bash
npm run dev
```

---

## 📊 Antes vs Depois

| Passo | Antes | Depois |
|------|-------|--------|
| Node.js version | v14.21.3 ❌ | v18.x ✅ |
| Build | Falha com erro de tipos | Sucesso ✅ |
| telefoneDecisor | Não suportado | Suportado ✅ |
| Migration | Criada mas não aplicada | Pronta para aplicar ✅ |

---

## 🎯 Arquivos de Referência

| Documento | Conteúdo |
|-----------|----------|
| [NODEJS_UPDATE_REQUIRED.md](NODEJS_UPDATE_REQUIRED.md) | Detalhes da atualização |
| [BUILD_TEMPORARIO.md](BUILD_TEMPORARIO.md) | Opções intermediárias |
| [QUICK_START.md](QUICK_START.md) | 5 passos após atualizar |

---

## ✨ Você Ficará Com

- ✅ Build compilando corretamente
- ✅ Sistema aceita snake_case nos webhooks
- ✅ Campo `telefoneDecisor` rastreado no banco
- ✅ Fase automática muda para `PRONTO_DECISOR`
- ✅ Tentativas resetam ao retargetar decisor
- ✅ Logging estruturado para debugging
- ✅ Documentação completa da API

---

**Tempo total: ~5 minutos**

Depois disso, siga [QUICK_START.md](QUICK_START.md) para aplicar a migration ao banco.

