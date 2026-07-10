-- CreateEnum
CREATE TYPE "OrigemNegociacao" AS ENUM ('ATIVA', 'RECEPTIVA');

-- CreateEnum
CREATE TYPE "EtapaNegociacao" AS ENUM ('PROSPECCAO', 'EM_LIGACAO', 'QUALIFICADO', 'REUNIAO_MARCADA', 'SEM_INTERESSE', 'PERDIDO', 'GANHO');

-- CreateEnum
CREATE TYPE "ResultadoTentativa" AS ENUM ('ATENDEU', 'NAO_ATENDEU', 'OCUPADO', 'CAIU', 'NUMERO_INVALIDO', 'CAIXA_POSTAL');

-- CreateEnum
CREATE TYPE "NivelInteresse" AS ENUM ('ALTO', 'MEDIO', 'BAIXO', 'SEM_INTERESSE');

-- CreateEnum
CREATE TYPE "StatusTarefa" AS ENUM ('PENDENTE', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'VENDEDOR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'VENDEDOR',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefonePrincipal" TEXT,
    "dominioEmail" TEXT,
    "cenarioAtendimento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "ehGatekeeper" BOOLEAN NOT NULL DEFAULT false,
    "ehDecisor" BOOLEAN NOT NULL DEFAULT false,
    "consentimentoLigacao" BOOLEAN NOT NULL DEFAULT true,
    "naoLigarNovamente" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contatos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negociacoes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "origem" "OrigemNegociacao" NOT NULL DEFAULT 'ATIVA',
    "etapa" "EtapaNegociacao" NOT NULL DEFAULT 'PROSPECCAO',
    "nivelInteresse" "NivelInteresse",
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "maxTentativas" INTEGER NOT NULL DEFAULT 5,
    "proximaTentativaPermitida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaTentativaEm" TIMESTAMP(3),
    "emFilaDiscagem" BOOLEAN NOT NULL DEFAULT true,
    "dorIdentificada" TEXT,
    "objecaoPrincipal" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negociacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentativas_ligacao" (
    "id" TEXT NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "resultado" "ResultadoTentativa",
    "dialerCallId" TEXT,
    "duracaoSegundos" INTEGER,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),

    CONSTRAINT "tentativas_ligacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes_eduarda" (
    "id" TEXT NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "agente" TEXT NOT NULL,
    "transferida" BOOLEAN NOT NULL DEFAULT false,
    "interesse" BOOLEAN NOT NULL DEFAULT false,
    "nivelInteresse" "NivelInteresse",
    "aceitouReuniao" BOOLEAN NOT NULL DEFAULT false,
    "horarioReuniaoSugerido" TEXT,
    "solicitouRetorno" BOOLEAN NOT NULL DEFAULT false,
    "resultadoLigacao" TEXT,
    "resumo" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacoes_eduarda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarefas" (
    "id" TEXT NOT NULL,
    "negociacaoId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "tipo" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3),
    "status" "StatusTarefa" NOT NULL DEFAULT 'PENDENTE',
    "descricao" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarefas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "empresas_nome_idx" ON "empresas"("nome");

-- CreateIndex
CREATE INDEX "contatos_empresaId_idx" ON "contatos"("empresaId");

-- CreateIndex
CREATE INDEX "contatos_telefone_idx" ON "contatos"("telefone");

-- CreateIndex
CREATE INDEX "negociacoes_etapa_idx" ON "negociacoes"("etapa");

-- CreateIndex
CREATE INDEX "negociacoes_emFilaDiscagem_proximaTentativaPermitida_idx" ON "negociacoes"("emFilaDiscagem", "proximaTentativaPermitida");

-- CreateIndex
CREATE INDEX "tentativas_ligacao_negociacaoId_idx" ON "tentativas_ligacao"("negociacaoId");

-- CreateIndex
CREATE INDEX "tentativas_ligacao_dialerCallId_idx" ON "tentativas_ligacao"("dialerCallId");

-- CreateIndex
CREATE INDEX "interacoes_eduarda_negociacaoId_idx" ON "interacoes_eduarda"("negociacaoId");

-- CreateIndex
CREATE INDEX "tarefas_negociacaoId_idx" ON "tarefas"("negociacaoId");

-- CreateIndex
CREATE INDEX "tarefas_responsavelId_status_idx" ON "tarefas"("responsavelId", "status");

-- AddForeignKey
ALTER TABLE "contatos" ADD CONSTRAINT "contatos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negociacoes" ADD CONSTRAINT "negociacoes_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "contatos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativas_ligacao" ADD CONSTRAINT "tentativas_ligacao_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "negociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes_eduarda" ADD CONSTRAINT "interacoes_eduarda_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "negociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_negociacaoId_fkey" FOREIGN KEY ("negociacaoId") REFERENCES "negociacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarefas" ADD CONSTRAINT "tarefas_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
