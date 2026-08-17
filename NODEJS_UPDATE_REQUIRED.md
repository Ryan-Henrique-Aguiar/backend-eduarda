# 🔧 Como Ativar Completamente o Sistema (Node.js 16+ necessário)

## ⚠️ Problema Atual

O projeto utiliza ferramentas que requerem **Node.js 16+**, mas seu ambiente tem **v14.21.3**.

### Passos Para Resolver

#### 1. Atualizar Node.js

```bash
# Opção A: Usar nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
nvm alias default 18

# Opção B: Instalar direto
# Baixe em: https://nodejs.org (LTS v18+)

# Verificar:
node --version  # Deve ser v16+
```

#### 2. Reinstalar Dependências

```bash
cd "/home/ryan/Área de Trabalho/Projects/Agente SDR/backend-eduarda"
rm -rf node_modules
npm install
```

#### 3. Regenerar Tipos Prisma

```bash
npx prisma generate
```

Isso vai gerar os tipos TypeScript para o novo campo `telefoneDecisor`.

#### 4. Build

```bash
npm run build
```

#### 5. Testar

```bash
npm run dev
```

---

## ✅ Status Atual

- ✅ Schema Prisma atualizado com `telefoneDecisor`
- ✅ Migration criada
- ✅ Código webh hook atualizado
- ⏳ Tipos TypeScript: **Aguardando npx prisma generate**
- ⏳ Build: **Aguardando Node.js 16+**

---

## 🎯 Quando Atualizar Node.js

Execute os comandos acima e tudo funcionará automaticamente!

