import { prisma } from "../lib/prisma.js";
import { WebhookRepository } from "../repositories/webhook.repository.js";
import type { DecisorInput, DialerStatusInput, GatekeeperInput } from "../schemas/webhooks.schemas.js";

const horasPorResultado: Record<string, number> = {
  NAO_ATENDEU: 2,
  OCUPADO: 1,
  CAIU: 4,
  CAIXA_POSTAL: 24,
  NUMERO_INVALIDO: 24 * 30,
};

function calcularProximaTentativa(resultado: string, tentativaAtual: number): Date {
  const proxima = new Date();
  const horas = (horasPorResultado[resultado] ?? 4) + tentativaAtual * 0.5;
  proxima.setHours(proxima.getHours() + horas);
  return proxima;
}

function proximaTentativaPorRetorno(): Date {
  const proxima = new Date();
  proxima.setHours(proxima.getHours() + 24);
  return proxima;
}

function mapearResultadoParaEtapa(resultadoLigacao: string, aceitouReuniao: boolean) {
  if (aceitouReuniao) return "REUNIAO_MARCADA" as const;
  if (resultadoLigacao === "sem_interesse") return "SEM_INTERESSE" as const;
  return "QUALIFICADO" as const;
}

export class WebhookService {
  async registrarStatusDialer(data: DialerStatusInput) {
    const repository = new WebhookRepository(prisma);
    const negociacao = await repository.findNegociacaoById(data.negociacaoId);
    if (!negociacao) throw new Error("NEGOCIACAO_NAO_ENCONTRADA");

    const numeroTentativa = negociacao.tentativas + 1;
    await repository.createTentativa({
      negociacao: { connect: { id: data.negociacaoId } },
      numero: numeroTentativa,
      resultado: data.resultado,
      dialerCallId: data.dialerCallId,
      duracaoSegundos: data.duracaoSegundos,
      finalizadaEm: new Date(),
    });

    if (data.resultado === "ATENDEU") {
      await repository.updateNegociacao(data.negociacaoId, {
        tentativas: numeroTentativa,
        ultimaTentativaEm: new Date(),
      });
      return { status: "aguardando_conversa_eduarda" } as const;
    }

    const esgotouTentativas = numeroTentativa >= negociacao.maxTentativas;
    await repository.updateNegociacao(data.negociacaoId, {
      tentativas: numeroTentativa,
      ultimaTentativaEm: new Date(),
      emFilaDiscagem: !esgotouTentativas,
      etapa: esgotouTentativas ? "PERDIDO" : "PROSPECCAO",
      proximaTentativaPermitida: esgotouTentativas
        ? negociacao.proximaTentativaPermitida
        : calcularProximaTentativa(data.resultado, numeroTentativa),
    });

    return { status: esgotouTentativas ? "esgotado" : "reagendado" } as const;
  }

  async registrarGatekeeper(data: GatekeeperInput) {
    return prisma.$transaction(async (tx) => {
      const repository = new WebhookRepository(tx);
      const negociacao = await repository.findNegociacaoContext(data.negociacaoId);
      if (!negociacao) throw new Error("NEGOCIACAO_NAO_ENCONTRADA");

      await repository.createInteracao({
        negociacao: { connect: { id: data.negociacaoId } },
        agente: "gatekeeper",
        transferida: data.transferida,
        interesse: data.interesse,
        solicitouRetorno: data.solicitouRetorno,
        horarioReuniaoSugerido: data.dataHoraContato,
        resumo: data.observacao,
      });

      if (data.telefoneEmpresa && !negociacao.empresa.telefonePrincipal) {
        await repository.updateEmpresa(negociacao.empresaId, { telefonePrincipal: data.telefoneEmpresa });
      }

      if (data.nomeDecisor) {
        const decisorExistente = await repository.findDecisor(negociacao.empresaId, data.nomeDecisor);
        const decisor = decisorExistente
          ? await repository.updateContato(decisorExistente.id, {
              cargo: data.cargoDecisor ?? decisorExistente.cargo,
              telefone: data.telefoneDecisor || decisorExistente.telefone,
              email: data.emailDecisor || decisorExistente.email,
              ehDecisor: true,
              ...(data.naoLigarNovamente !== undefined
                ? { naoLigarNovamente: data.naoLigarNovamente }
                : {}),
              ...(data.consentimentoLigacao !== undefined
                ? { consentimentoLigacao: data.consentimentoLigacao }
                : {}),
            })
          : await repository.createContato({
              empresa: { connect: { id: negociacao.empresaId } },
              nome: data.nomeDecisor,
              cargo: data.cargoDecisor,
              telefone: data.telefoneDecisor,
              email: data.emailDecisor,
              ehDecisor: true,
              naoLigarNovamente: data.naoLigarNovamente,
              consentimentoLigacao: data.consentimentoLigacao,
            });

        await repository.updateNegociacao(data.negociacaoId, {
          contato: { connect: { id: decisor.id } },
          faseAutomacao: "PRONTO_DECISOR",
          observacao: data.observacao,
          tentativas: 0,
          proximaTentativaPermitida: new Date(),
          ...(data.transferida
            ? {}
            : {
                emFilaDiscagem: data.interesse,
                proximaTentativaPermitida: data.solicitouRetorno
                  ? proximaTentativaPorRetorno()
                  : new Date(),
              }),
        });

        if (data.solicitouRetorno) {
          await repository.createTarefa({
            negociacao: { connect: { id: data.negociacaoId } },
            tipo: "retorno",
            descricao: `Gatekeeper pediu retorno: ${data.dataHoraContato ?? "sem horário definido"}`,
          });
        }
      } else if (!data.interesse) {
        await repository.updateNegociacao(data.negociacaoId, {
          emFilaDiscagem: false,
          etapa: "SEM_INTERESSE",
        });
        await repository.updateContato(negociacao.contatoId, {
          naoLigarNovamente: data.naoLigarNovamente ?? true,
          ...(data.consentimentoLigacao !== undefined
            ? { consentimentoLigacao: data.consentimentoLigacao }
            : {}),
        });
      } else if (data.naoLigarNovamente !== undefined || data.consentimentoLigacao !== undefined) {
        await repository.updateContato(negociacao.contatoId, {
          ...(data.naoLigarNovamente !== undefined
            ? { naoLigarNovamente: data.naoLigarNovamente }
            : {}),
          ...(data.consentimentoLigacao !== undefined
            ? { consentimentoLigacao: data.consentimentoLigacao }
            : {}),
        });
      }

      return { status: "registrado" } as const;
    });
  }

  async registrarDecisor(data: DecisorInput) {
    const nomeDecisor = data.nomeDecisor ?? data.nomeContato;
    const cargoDecisor = data.cargoDecisor ?? data.cargo;
    const emailDecisor = data.emailDecisor || data.email;
    const telefoneDecisor = data.telefoneDecisor ?? data.telefone;

    if (!nomeDecisor) throw new Error("NOME_DECISOR_OBRIGATORIO");
    const novaEtapa = mapearResultadoParaEtapa(data.resultadoLigacao, data.aceitouReuniao);

    const negociacao = await prisma.$transaction(async (tx) => {
      const repository = new WebhookRepository(tx);
      let negociacao = data.negociacaoId
        ? await repository.findNegociacaoById(data.negociacaoId)
        : null;

      if (!negociacao) {
        if (data.negociacaoId) throw new Error("NEGOCIACAO_NAO_ENCONTRADA");
        if (!data.nomeEmpresa) throw new Error("NOME_EMPRESA_OBRIGATORIO");

        const empresaExistente = await repository.findEmpresaByName(data.nomeEmpresa);
        const empresa = empresaExistente
          ? await repository.updateEmpresa(empresaExistente.id, {
              telefonePrincipal: data.telefoneEmpresa || empresaExistente.telefonePrincipal,
              cenarioAtendimento: data.cenarioAtendimento || empresaExistente.cenarioAtendimento,
            })
          : await repository.createEmpresa({
              nome: data.nomeEmpresa,
              telefonePrincipal: data.telefoneEmpresa,
              cenarioAtendimento: data.cenarioAtendimento,
            });

        const contatoExistente = await repository.findContato(
          empresa.id,
          emailDecisor,
          telefoneDecisor,
          nomeDecisor,
        );
        const contato = contatoExistente
          ? await repository.updateContato(contatoExistente.id, {
              nome: nomeDecisor,
              cargo: cargoDecisor ?? contatoExistente.cargo,
              email: emailDecisor || contatoExistente.email,
              telefone: telefoneDecisor || contatoExistente.telefone,
              ehDecisor: data.ehdecisor ?? true,
              naoLigarNovamente: data.naoLigarNovamente ?? contatoExistente.naoLigarNovamente,
              consentimentoLigacao: data.consentimentoLigacao ?? contatoExistente.consentimentoLigacao,
            })
          : await repository.createContato({
              empresa: { connect: { id: empresa.id } },
              nome: nomeDecisor,
              cargo: cargoDecisor,
              email: emailDecisor,
              telefone: telefoneDecisor,
              ehDecisor: data.ehdecisor ?? true,
              naoLigarNovamente: data.naoLigarNovamente,
              consentimentoLigacao: data.consentimentoLigacao,
            });

        negociacao = await tx.negociacao.create({
          data: {
            empresa: { connect: { id: empresa.id } },
            contato: { connect: { id: contato.id } },
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

      await repository.createInteracao({
        negociacao: { connect: { id: negociacao.id } },
        agente: "decisor",
        interesse: data.interesse,
        nivelInteresse: data.nivelInteresse,
        aceitouReuniao: data.aceitouReuniao,
        horarioReuniaoSugerido: data.horarioReuniaoSugerido,
        solicitouRetorno: data.solicitouRetorno,
        resultadoLigacao: data.resultadoLigacao,
        resumo: data.observacao,
      });

      await repository.updateNegociacao(negociacao.id, {
        etapa: novaEtapa,
        nivelInteresse: data.nivelInteresse,
        dorIdentificada: data.dorIdentificada ?? data.cenarioAtendimento,
        objecaoPrincipal: data.objecaoPrincipal,
        observacao: data.observacao,
        emFilaDiscagem: false,
      });

      await repository.updateContato(negociacao.contatoId, {
        nome: nomeDecisor,
        cargo: cargoDecisor ?? undefined,
        email: emailDecisor || undefined,
        telefone: telefoneDecisor || undefined,
        ...(data.naoLigarNovamente !== undefined || data.decisorPediuNaoLigarMais
          ? { naoLigarNovamente: data.naoLigarNovamente ?? data.decisorPediuNaoLigarMais }
          : {}),
        ...(data.consentimentoLigacao !== undefined
          ? { consentimentoLigacao: data.consentimentoLigacao }
          : {}),
      });

      if (data.aceitouReuniao || data.solicitouRetorno) {
        await repository.createTarefa({
          negociacao: { connect: { id: negociacao.id } },
          tipo: data.aceitouReuniao ? "reuniao" : "retorno",
          descricao: `${data.aceitouReuniao ? "Reunião sugerida" : "Retorno solicitado"}: ${data.horarioReuniaoSugerido ?? (data.aceitouReuniao ? "horário a combinar" : "sem horário definido")}`,
        });
      }

      return negociacao;
    });

    return { negociacaoId: negociacao.id, etapa: novaEtapa };
  }
}

export const webhookService = new WebhookService();
