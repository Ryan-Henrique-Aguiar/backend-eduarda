import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const dialerStatusBody = z.object({
  negociacaoId: z.string().uuid(),
  dialerCallId: z.string().optional(),
  resultado: z.enum([
    "ATENDEU",
    "NAO_ATENDEU",
    "OCUPADO",
    "CAIU",
    "NUMERO_INVALIDO",
    "CAIXA_POSTAL",
  ]),
  duracaoSegundos: z.number().optional(),
});

const gatekeeperBody = z.object({
  negociacaoId: z.string().uuid(),
  nomeGatekeeper: z.string().optional(),
  nomeDecisorIdentificado: z.string().optional(),
  transferida: z.boolean().default(false),
  observacao: z.string().optional(),
});

const decisorBody = z.object({
  negociacaoId: z.string().uuid(),
  nomeDecisor: z.string().min(1),
  cargoDecisor: z.string().optional(),
  emailDecisor: z.string().email().optional().or(z.literal("")),
  telefoneDecisor: z.string().optional(),
  cenarioAtendimento: z.string().optional(),
  interesse: z.boolean(),
  nivelInteresse: z.enum(["ALTO", "MEDIO", "BAIXO", "SEM_INTERESSE"]),
  aceitouReuniao: z.boolean(),
  horarioReuniaoSugerido: z.string().optional(),
  solicitouRetorno: z.boolean().default(false),
  resultadoLigacao: z.string(),
  observacao: z.string().min(1),
  decisorPediuNaoLigarMais: z.boolean().default(false),
});

// Regra de backoff simples: quanto maior a tentativa, maior o intervalo.
// Ajuste esses valores conforme a política comercial definida.
function calcularProximaTentativa(resultado: string, tentativaAtual: number): Date {
  const agora = new Date();
  const horasPorResultado: Record<string, number> = {
    NAO_ATENDEU: 2,
    OCUPADO: 1,
    CAIU: 4,
    CAIXA_POSTAL: 24,
    NUMERO_INVALIDO: 24 * 30, // efetivamente "não tentar de novo tão cedo"
  };

  const horasBase = horasPorResultado[resultado] ?? 4;
  // pequeno incremento a cada tentativa para não martelar sempre no mesmo intervalo
  const horas = horasBase + tentativaAtual * 0.5;

  agora.setHours(agora.getHours() + horas);
  return agora;
}

function mapearResultadoParaEtapa(resultadoLigacao: string, aceitouReuniao: boolean) {
  if (aceitouReuniao) return "REUNIAO_MARCADA" as const;
  if (resultadoLigacao === "sem_interesse") return "SEM_INTERESSE" as const;
  if (resultadoLigacao === "interessado_com_retorno") return "QUALIFICADO" as const;
  return "QUALIFICADO" as const;
}

export async function webhookRoutes(fastify: FastifyInstance) {
  // Todas as rotas aqui são chamadas por serviços (Dialer, Eduarda), não por humanos
  fastify.addHook("preHandler", fastify.authenticateService);

  // -------- Dialer: status de cada tentativa de ligação --------
  fastify.post("/webhooks/dialer/status", async (request, reply) => {
    const parsed = dialerStatusBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const { negociacaoId, dialerCallId, resultado, duracaoSegundos } = parsed.data;

    const negociacao = await prisma.negociacao.findUnique({ where: { id: negociacaoId } });
    if (!negociacao) {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }

    const numeroTentativa = negociacao.tentativas + 1;

    await prisma.tentativaLigacao.create({
      data: {
        negociacaoId,
        numero: numeroTentativa,
        resultado,
        dialerCallId,
        duracaoSegundos,
        finalizadaEm: new Date(),
      },
    });

    if (resultado === "ATENDEU") {
      // Não reagenda: aguarda o webhook da Eduarda (gatekeeper/decisor)
      // para saber o desfecho real da conversa.
      await prisma.negociacao.update({
        where: { id: negociacaoId },
        data: { tentativas: numeroTentativa, ultimaTentativaEm: new Date() },
      });
      return reply.send({ status: "aguardando_conversa_eduarda" });
    }

    const esgotouTentativas = numeroTentativa >= negociacao.maxTentativas;

    await prisma.negociacao.update({
      where: { id: negociacaoId },
      data: {
        tentativas: numeroTentativa,
        ultimaTentativaEm: new Date(),
        emFilaDiscagem: !esgotouTentativas,
        etapa: esgotouTentativas ? "PERDIDO" : "PROSPECCAO",
        proximaTentativaPermitida: esgotouTentativas
          ? negociacao.proximaTentativaPermitida
          : calcularProximaTentativa(resultado, numeroTentativa),
      },
    });

    return reply.send({ status: esgotouTentativas ? "esgotado" : "reagendado" });
  });

  // -------- Eduarda: agente Gatekeeper --------
  fastify.post("/webhooks/eduarda/gatekeeper", async (request, reply) => {
    const parsed = gatekeeperBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const data = parsed.data;

    const negociacao = await prisma.negociacao.findUnique({ where: { id: data.negociacaoId } });
    if (!negociacao) {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }

    await prisma.interacaoEduarda.create({
      data: {
        negociacaoId: data.negociacaoId,
        agente: "gatekeeper",
        transferida: data.transferida,
        resumo: data.observacao,
      },
    });

    // Se não houve transferência, a ligação terminou sem chegar ao decisor:
    // volta para a fila normalmente (o webhook de status do Dialer já cuidou do backoff).
    return reply.send({ status: "registrado" });
  });

  // -------- Eduarda: agente Decisor (tool resposta-decisor) --------
  fastify.post("/webhooks/eduarda/decisor", async (request, reply) => {
    const parsed = decisorBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const data = parsed.data;

    const negociacao = await prisma.negociacao.findUnique({
      where: { id: data.negociacaoId },
      include: { contato: true },
    });
    if (!negociacao) {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }

    const novaEtapa = mapearResultadoParaEtapa(data.resultadoLigacao, data.aceitouReuniao);

    await prisma.$transaction(async (tx) => {
      await tx.interacaoEduarda.create({
        data: {
          negociacaoId: data.negociacaoId,
          agente: "decisor",
          interesse: data.interesse,
          nivelInteresse: data.nivelInteresse,
          aceitouReuniao: data.aceitouReuniao,
          horarioReuniaoSugerido: data.horarioReuniaoSugerido,
          solicitouRetorno: data.solicitouRetorno,
          resultadoLigacao: data.resultadoLigacao,
          resumo: data.observacao,
        },
      });

      await tx.negociacao.update({
        where: { id: data.negociacaoId },
        data: {
          etapa: novaEtapa,
          nivelInteresse: data.nivelInteresse,
          dorIdentificada: data.cenarioAtendimento,
          observacao: data.observacao,
          // Para de discar assim que houve conversa real com o decisor,
          // independentemente do resultado.
          emFilaDiscagem: false,
        },
      });

      await tx.contato.update({
        where: { id: negociacao.contatoId },
        data: {
          cargo: data.cargoDecisor ?? undefined,
          email: data.emailDecisor || undefined,
          telefone: data.telefoneDecisor || undefined,
          naoLigarNovamente: data.decisorPediuNaoLigarMais,
        },
      });

      if (data.aceitouReuniao) {
        await tx.tarefa.create({
          data: {
            negociacaoId: data.negociacaoId,
            tipo: "reuniao",
            descricao: `Reunião sugerida: ${data.horarioReuniaoSugerido ?? "horário a combinar"}`,
          },
        });
      } else if (data.solicitouRetorno) {
        await tx.tarefa.create({
          data: {
            negociacaoId: data.negociacaoId,
            tipo: "retorno",
            descricao: `Retorno solicitado: ${data.horarioReuniaoSugerido ?? "sem horário definido"}`,
          },
        });
      }
    });

    return reply.send({ status: "registrado", etapa: novaEtapa });
  });
}
