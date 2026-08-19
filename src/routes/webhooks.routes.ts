import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

// Transforma snake_case para camelCase automaticamente
const transformarSnakeToCamel = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(transformarSnakeToCamel);
  if (obj !== null && obj.constructor === Object) {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
      acc[camelKey] = transformarSnakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
};

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
}).transform(transformarSnakeToCamel);

const decisorBody = z.object({
  negociacaoId: z.preprocess(
    (value) => value === null || value === "null" || value === "" ? undefined : value,
    z.string().uuid().optional(),
  ),
  nomeEmpresa: z.string().min(1).optional(),
  telefoneEmpresa: z.string().optional(),
  nomeContato: z.string().min(1).optional(),
  ehdecisor: z.boolean().optional(),
  nomeDecisor: z.string().min(1).optional(),
  cargoDecisor: z.string().optional(),
  cargo: z.string().optional(),
  emailDecisor: z.string().email().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  telefoneDecisor: z.string().optional(),
  telefone: z.string().optional(),
  cenarioAtendimento: z.string().optional(),
  dorIdentificada: z.string().optional(),
  objecaoPrincipal: z.string().optional(),
  interesse: z.boolean(),
  nivelInteresse: z.preprocess(
    (value) => typeof value === "string" ? value.toUpperCase() : value,
    z.enum(["ALTO", "MEDIO", "BAIXO", "SEM_INTERESSE"]),
  ),
  aceitouReuniao: z.boolean(),
  horarioReuniaoSugerido: z.string().optional(),
  dataHoraContato: z.string().optional(),
  solicitouRetorno: z.boolean().default(false),
  resultadoLigacao: z.string(),
  observacao: z.string().min(1),
  decisorPediuNaoLigarMais: z.boolean().default(false),
}).transform(transformarSnakeToCamel);

const gatekeeperBody = z.object({
  negociacaoId: z.string().uuid(),
  telefoneEmpresa: z.string().optional(),
  nomeDecisor: z.string().min(1).optional(),
  cargoDecisor: z.string().optional(),
  emailDecisor: z.string().email().optional().or(z.literal("")),
  telefoneDecisor: z.string().optional(),
  dataHoraContato: z.string().optional(),
  observacao: z.string().min(1),
  interesse: z.boolean(),
  transferida: z.boolean(),
  solicitouRetorno: z.boolean().default(false),
}).transform(transformarSnakeToCamel);

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

// O gatekeeper fala a data/horário de forma livre (ex: "amanhã de manhã"),
// e não tentamos parsear isso aqui — quem vê o texto exato é a Tarefa criada
// para o time comercial. Aqui só evitamos que o número seja discado de novo
// imediatamente; um valor conservador de 24h é seguro como padrão.
function proximaTentativaPorRetorno(): Date {
  const proxima = new Date();
  proxima.setHours(proxima.getHours() + 24);
  return proxima;
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

    const negociacao = await prisma.negociacao.findUnique({
      where: { id: data.negociacaoId },
      include: { empresa: true, contato: true },
    });
    if (!negociacao) {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }

    console.log(`[GATEKEEPER] Iniciando processamento - NegociacaoId: ${data.negociacaoId}`, {
      nomeDecisor: data.nomeDecisor,
      telefoneDecisor: data.telefoneDecisor,
      interesse: data.interesse,
      transferida: data.transferida,
    });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.interacaoEduarda.create({
          data: {
            negociacaoId: data.negociacaoId,
            agente: "gatekeeper",
            transferida: data.transferida,
            interesse: data.interesse,
            solicitouRetorno: data.solicitouRetorno,
            horarioReuniaoSugerido: data.dataHoraContato,
            resumo: data.observacao,
          },
        });

        // Telefone da empresa: grava só se ainda não tínhamos.
        if (data.telefoneEmpresa && !negociacao.empresa.telefonePrincipal) {
          console.log(`[GATEKEEPER] Atualizando telefone da empresa: ${data.telefoneEmpresa}`);
          await tx.empresa.update({
            where: { id: negociacao.empresaId },
            data: { telefonePrincipal: data.telefoneEmpresa },
          });
        }

        if (data.nomeDecisor) {
          console.log(`[GATEKEEPER] Decisor identificado: ${data.nomeDecisor} - Telefone: ${data.telefoneDecisor}`);
          
          // Busca se esse decisor já existe como contato da mesma empresa
          // (ex: uma tentativa anterior já tinha descoberto o nome dele).
          const decisorExistente = await tx.contato.findFirst({
            where: {
              empresaId: negociacao.empresaId,
              nome: { equals: data.nomeDecisor, mode: "insensitive" },
            },
          });

          const decisor = decisorExistente
            ? await tx.contato.update({
                where: { id: decisorExistente.id },
                data: {
                  cargo: data.cargoDecisor ?? decisorExistente.cargo,
                  telefone: data.telefoneDecisor || decisorExistente.telefone,
                  email: data.emailDecisor || decisorExistente.email,
                  ehDecisor: true,
                },
              })
            : await tx.contato.create({
                data: {
                  empresaId: negociacao.empresaId,
                  nome: data.nomeDecisor,
                  cargo: data.cargoDecisor,
                  telefone: data.telefoneDecisor,
                  email: data.emailDecisor,
                  ehDecisor: true,
                },
              });

          // Retargeta a negociação: a próxima tentativa liga direto pro decisor,
          // não mais pra recepção/linha geral que atendeu dessa vez.
          // Reseta tentativas para começar fresh com decisor
          // @ts-ignore - campo telefoneDecisor será tipado após npx prisma generate (Node.js 16+)
          await tx.negociacao.update({
            where: { id: data.negociacaoId },
            data: {
              contatoId: decisor.id,
              faseAutomacao: "PRONTO_DECISOR",
              // telefoneDecisor: data.telefoneDecisor, // TODO: Ativar após npx prisma generate com Node.js 16+
              observacao: data.observacao,
              tentativas: 0, // reseta contador ao retargetar para decisor
              proximaTentativaPermitida: new Date(), // permite ligar imediatamente
              // Se já transferiu a ligação agora, quem grava o desfecho final
              // é o webhook do Decisor (chamado na sequência, mesma chamada).
              // Se não transferiu, decidimos aqui se volta pra fila.
              ...(data.transferida
                ? {}
                : {
                    emFilaDiscagem: data.interesse,
                    proximaTentativaPermitida: data.solicitouRetorno
                      ? proximaTentativaPorRetorno()
                      : new Date(),
                  }),
            },
          });

          console.log(`[GATEKEEPER] ✓ Negociação retargetizada - ContatoId: ${decisor.id}, FaseAutomacao: PRONTO_DECISOR`);

          if (data.solicitouRetorno) {
            console.log(`[GATEKEEPER] Criando tarefa de retorno: ${data.dataHoraContato}`);
            await tx.tarefa.create({
              data: {
                negociacaoId: data.negociacaoId,
                tipo: "retorno",
                descricao: `Gatekeeper pediu retorno: ${data.dataHoraContato ?? "sem horário definido"}`,
              },
            });
          }
        } else if (!data.interesse) {
          // Não identificou decisor nenhum e não há abertura: para de insistir
          // com esse número (recepção/gatekeeper que atendeu desta vez).
          console.log(`[GATEKEEPER] ⚠️ Sem interesse e sem decisor identificado - Parando tentativas`);
          await tx.negociacao.update({
            where: { id: data.negociacaoId },
            data: { emFilaDiscagem: false, etapa: "SEM_INTERESSE" },
          });
          await tx.contato.update({
            where: { id: negociacao.contatoId },
            data: { naoLigarNovamente: true },
          });
        }
      });

      console.log(`[GATEKEEPER] ✓ Webhook processado com sucesso - NegociacaoId: ${data.negociacaoId}`);
      return reply.send({ status: "registrado" });
    } catch (error) {
      console.error(`[GATEKEEPER] ✗ ERRO ao processar webhook`, {
        negociacaoId: data.negociacaoId,
        erro: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  // -------- Eduarda: agente Decisor (tool resposta-decisor) --------
  fastify.post("/webhooks/eduarda/decisor", async (request, reply) => {
    const parsed = decisorBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const data = parsed.data;

    const nomeDecisor = data.nomeDecisor ?? data.nomeContato;
    const cargoDecisor = data.cargoDecisor ?? data.cargo;
    const emailDecisor = data.emailDecisor || data.email;
    const telefoneDecisor = data.telefoneDecisor ?? data.telefone;
    if (!nomeDecisor) {
      return reply.code(400).send({ error: "Informe nomeDecisor ou nome_contato." });
    }

    const novaEtapa = mapearResultadoParaEtapa(data.resultadoLigacao, data.aceitouReuniao);

    console.log(`[DECISOR] Iniciando processamento - NegociacaoId: ${data.negociacaoId}`, {
      nomeDecisor,
      interesse: data.interesse,
      nivelInteresse: data.nivelInteresse,
      aceitouReuniao: data.aceitouReuniao,
      resultadoLigacao: data.resultadoLigacao,
      novaEtapa,
    });

    try {
      const negociacao = await prisma.$transaction(async (tx) => {
        let negociacao = data.negociacaoId
          ? await tx.negociacao.findUnique({ where: { id: data.negociacaoId } })
          : null;

        if (!negociacao) {
          if (data.negociacaoId) {
            throw new Error("NEGOCIACAO_NAO_ENCONTRADA");
          }
          if (!data.nomeEmpresa) {
            throw new Error("NOME_EMPRESA_OBRIGATORIO");
          }

          const empresaExistente = await tx.empresa.findFirst({
            where: { nome: { equals: data.nomeEmpresa, mode: "insensitive" } },
          });
          const empresa = empresaExistente
            ? await tx.empresa.update({
                where: { id: empresaExistente.id },
                data: {
                  telefonePrincipal: data.telefoneEmpresa || empresaExistente.telefonePrincipal,
                  cenarioAtendimento: data.cenarioAtendimento || empresaExistente.cenarioAtendimento,
                },
              })
            : await tx.empresa.create({
                data: {
                  nome: data.nomeEmpresa,
                  telefonePrincipal: data.telefoneEmpresa,
                  cenarioAtendimento: data.cenarioAtendimento,
                },
              });

          const contatoExistente = await tx.contato.findFirst({
            where: {
              empresaId: empresa.id,
              OR: [
                ...(emailDecisor ? [{ email: emailDecisor }] : []),
                ...(telefoneDecisor ? [{ telefone: telefoneDecisor }] : []),
                { nome: { equals: nomeDecisor, mode: "insensitive" } },
              ],
            },
          });
          const contato = contatoExistente
            ? await tx.contato.update({
                where: { id: contatoExistente.id },
                data: {
                  nome: nomeDecisor,
                  cargo: cargoDecisor ?? contatoExistente.cargo,
                  email: emailDecisor || contatoExistente.email,
                  telefone: telefoneDecisor || contatoExistente.telefone,
                  ehDecisor: data.ehdecisor ?? true,
                },
              })
            : await tx.contato.create({
                data: {
                  empresaId: empresa.id,
                  nome: nomeDecisor,
                  cargo: cargoDecisor,
                  email: emailDecisor,
                  telefone: telefoneDecisor,
                  ehDecisor: data.ehdecisor ?? true,
                },
              });

          negociacao = await tx.negociacao.create({
            data: {
              empresaId: empresa.id,
              contatoId: contato.id,
              origem: "RECEPTIVA",
              etapa: novaEtapa,
              nivelInteresse: data.nivelInteresse,
              faseAutomacao: "FINALIZADO",
              emFilaDiscagem: false,
              dorIdentificada: data.dorIdentificada ?? data.cenarioAtendimento,
              objecaoPrincipal: data.objecaoPrincipal,
              observacao: data.observacao,
            },
          });
        }

        await tx.interacaoEduarda.create({
          data: {
            negociacaoId: negociacao.id,
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
          where: { id: negociacao.id },
          data: {
            etapa: novaEtapa,
            nivelInteresse: data.nivelInteresse,
            dorIdentificada: data.dorIdentificada ?? data.cenarioAtendimento,
            objecaoPrincipal: data.objecaoPrincipal,
            observacao: data.observacao,
            // Para de discar assim que houve conversa real com o decisor,
            // independentemente do resultado.
            emFilaDiscagem: false,
          },
        });

        console.log(`[DECISOR] ✓ Negociação atualizada - Etapa: ${novaEtapa}, Interesse: ${data.nivelInteresse}`);

        await tx.contato.update({
          where: { id: negociacao.contatoId },
          data: {
            nome: nomeDecisor,
            cargo: cargoDecisor ?? undefined,
            email: emailDecisor || undefined,
            telefone: telefoneDecisor || undefined,
            naoLigarNovamente: data.decisorPediuNaoLigarMais,
          },
        });

        if (data.aceitouReuniao) {
          console.log(`[DECISOR] Criando tarefa de reunião: ${data.horarioReuniaoSugerido}`);
          await tx.tarefa.create({
            data: {
                negociacaoId: negociacao.id,
              tipo: "reuniao",
              descricao: `Reunião sugerida: ${data.horarioReuniaoSugerido ?? "horário a combinar"}`,
            },
          });
        } else if (data.solicitouRetorno) {
          console.log(`[DECISOR] Criando tarefa de retorno: ${data.horarioReuniaoSugerido}`);
          await tx.tarefa.create({
            data: {
                negociacaoId: negociacao.id,
              tipo: "retorno",
              descricao: `Retorno solicitado: ${data.horarioReuniaoSugerido ?? "sem horário definido"}`,
            },
          });
        }

        return negociacao;
      });

      console.log(`[DECISOR] ✓ Webhook processado com sucesso - NegociacaoId: ${negociacao.id}`);
      return reply.send({ status: "registrado", etapa: novaEtapa, negociacaoId: negociacao.id });
    } catch (error) {
      if (error instanceof Error && error.message === "NEGOCIACAO_NAO_ENCONTRADA") {
        return reply.code(404).send({ error: "Negociação não encontrada." });
      }
      if (error instanceof Error && error.message === "NOME_EMPRESA_OBRIGATORIO") {
        return reply.code(400).send({ error: "nome_empresa é obrigatório quando negociacaoId é nulo." });
      }
      console.error(`[DECISOR] ✗ ERRO ao processar webhook`, {
        negociacaoId: data.negociacaoId,
        erro: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });
}