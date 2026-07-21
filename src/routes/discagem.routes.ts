import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const marcarEnviadoBody = z.object({
  negociacaoIds: z.array(z.string().uuid()).min(1),
});

export async function discagemRoutes(fastify: FastifyInstance) {
  // Todas as rotas aqui são chamadas por serviços (n8n), não por humanos
  fastify.addHook("preHandler", fastify.authenticateService);

  // n8n consulta essa rota periodicamente (ex: a cada 15 min) para saber
  // quem pode ser discado agora.
  fastify.get("/discagem/fila-elegivel", async (request, reply) => {
    const { limite } = request.query as { limite?: string };
    const take = limite ? Math.min(Number(limite), 200) : 50;

    // Nota: o Prisma Client não compara duas colunas da mesma linha
    // (tentativas < maxTentativas) diretamente no `where`, então buscamos
    // um lote maior já filtrado pelo resto das condições e aplicamos essa
    // comparação em código antes de cortar no "take" real.
    const candidatos = await prisma.negociacao.findMany({
      where: {
        emFilaDiscagem: true,
        faseAutomacao: { in: ["PRONTO_GATEKEEPER", "PRONTO_DECISOR"] },
        proximaTentativaPermitida: { lte: new Date() },
        contato: {
          naoLigarNovamente: false,
          consentimentoLigacao: true,
          OR: [
            { telefone: { not: null } },
            { empresa: { telefonePrincipal: { not: null } } },
          ],
        },
      },
      include: {
        contato: true,
        empresa: {
          include: {
            contatos: {
              where: { ehGatekeeper: true },
              select: { nome: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { proximaTentativaPermitida: "asc" },
      take: take * 3,
    });

    const negociacoes = candidatos
      .filter((n) => n.tentativas < n.maxTentativas)
      .filter((n) => n.contato.telefone || n.empresa.telefonePrincipal)
      .slice(0, take);

    const itens = negociacoes.map((n) => ({
      negociacaoId: n.id,
      telefone: n.contato.telefone ?? n.empresa.telefonePrincipal,
      nomeContato: n.contato.nome,
      nomeEmpresa: n.empresa.nome,
      nomeGatekeeper: n.empresa.contatos[0]?.nome ?? (n.contato.ehGatekeeper ? n.contato.nome : undefined),
      tentativaNumero: n.tentativas + 1,
      observacao: n.observacao,
      observacaoInicial: n.observacaoInicial ?? n.observacao,
    }));

    return reply.send({ itens });
  });

  // n8n chama isso depois que o Dialer confirmou que aceitou a lista,
  // para essas negociações não serem selecionadas de novo no próximo ciclo.
  fastify.post("/discagem/marcar-enviado", async (request, reply) => {
    const parsed = marcarEnviadoBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }

    await prisma.negociacao.updateMany({
      where: { id: { in: parsed.data.negociacaoIds } },
      data: { etapa: "EM_LIGACAO", emFilaDiscagem: false },
    });

    return reply.send({ atualizado: parsed.data.negociacaoIds.length });
  });
}
