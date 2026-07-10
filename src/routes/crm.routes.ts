import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const listNegociacoesQuery = z.object({
  etapa: z.string().optional(),
  nivelInteresse: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

const patchNegociacaoBody = z.object({
  etapa: z.string().optional(),
  observacao: z.string().optional(),
  nivelInteresse: z.string().optional(),
});

const createNegociacaoBody = z.object({
  empresaId: z.string().uuid(),
  contatoId: z.string().uuid(),
  origem: z.enum(["ATIVA", "RECEPTIVA"]).default("ATIVA"),
});

const createEmpresaBody = z.object({
  nome: z.string().min(1),
  telefonePrincipal: z.string().optional(),
  dominioEmail: z.string().optional(),
});

const createContatoBody = z.object({
  empresaId: z.string().uuid(),
  nome: z.string().min(1),
  cargo: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  ehGatekeeper: z.boolean().optional(),
  ehDecisor: z.boolean().optional(),
});

const patchContatoBody = z.object({
  nome: z.string().optional(),
  cargo: z.string().optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  naoLigarNovamente: z.boolean().optional(),
  consentimentoLigacao: z.boolean().optional(),
});

const patchTarefaBody = z.object({
  status: z.enum(["PENDENTE", "CONCLUIDA", "CANCELADA"]),
});

export async function crmRoutes(fastify: FastifyInstance) {
  // Todas as rotas deste arquivo exigem login do painel
  fastify.addHook("preHandler", fastify.authenticate);

  // ---------------- Negociações ----------------

  fastify.get("/negociacoes", async (request, reply) => {
    const parsed = listNegociacoesQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Parâmetros de busca inválidos." });
    }
    const { etapa, nivelInteresse, page, pageSize } = parsed.data;

    const where = {
      ...(etapa ? { etapa: etapa as never } : {}),
      ...(nivelInteresse ? { nivelInteresse: nivelInteresse as never } : {}),
    };

    const [itens, total] = await Promise.all([
      prisma.negociacao.findMany({
        where,
        include: { empresa: true, contato: true },
        orderBy: { atualizadoEm: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.negociacao.count({ where }),
    ]);

    return reply.send({ itens, total, page, pageSize });
  });

  fastify.get<{ Params: { id: string } }>("/negociacoes/:id", async (request, reply) => {
    const negociacao = await prisma.negociacao.findUnique({
      where: { id: request.params.id },
      include: {
        empresa: true,
        contato: true,
        tentativasLigacao: { orderBy: { numero: "asc" } },
        interacoes: { orderBy: { criadaEm: "asc" } },
        tarefas: { orderBy: { criadaEm: "desc" } },
      },
    });

    if (!negociacao) {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }

    return reply.send(negociacao);
  });

  fastify.post("/negociacoes", async (request, reply) => {
    const parsed = createNegociacaoBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }

    const negociacao = await prisma.negociacao.create({ data: parsed.data });
    return reply.code(201).send(negociacao);
  });

  fastify.patch<{ Params: { id: string } }>("/negociacoes/:id", async (request, reply) => {
    const parsed = patchNegociacaoBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }

    try {
      const negociacao = await prisma.negociacao.update({
        where: { id: request.params.id },
        data: parsed.data as never,
      });
      return reply.send(negociacao);
    } catch {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }
  });

  // ---------------- Empresas ----------------

  fastify.get("/empresas", async (request, reply) => {
    const { busca } = request.query as { busca?: string };
    const empresas = await prisma.empresa.findMany({
      where: busca ? { nome: { contains: busca, mode: "insensitive" } } : undefined,
      orderBy: { nome: "asc" },
      take: 50,
    });
    return reply.send(empresas);
  });

  fastify.post("/empresas", async (request, reply) => {
    const parsed = createEmpresaBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const empresa = await prisma.empresa.create({ data: parsed.data });
    return reply.code(201).send(empresa);
  });

  fastify.get<{ Params: { id: string } }>("/empresas/:id", async (request, reply) => {
    const empresa = await prisma.empresa.findUnique({
      where: { id: request.params.id },
      include: { contatos: true, negociacoes: true },
    });
    if (!empresa) {
      return reply.code(404).send({ error: "Empresa não encontrada." });
    }
    return reply.send(empresa);
  });

  // ---------------- Contatos ----------------

  fastify.post("/contatos", async (request, reply) => {
    const parsed = createContatoBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    const contato = await prisma.contato.create({ data: parsed.data });
    return reply.code(201).send(contato);
  });

  fastify.patch<{ Params: { id: string } }>("/contatos/:id", async (request, reply) => {
    const parsed = patchContatoBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
    }
    try {
      const contato = await prisma.contato.update({
        where: { id: request.params.id },
        data: parsed.data,
      });
      return reply.send(contato);
    } catch {
      return reply.code(404).send({ error: "Contato não encontrado." });
    }
  });

  // ---------------- Tarefas ----------------

  fastify.get("/tarefas", async (request, reply) => {
    const { responsavelId, status } = request.query as { responsavelId?: string; status?: string };
    const tarefas = await prisma.tarefa.findMany({
      where: {
        ...(responsavelId ? { responsavelId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: { negociacao: { include: { empresa: true, contato: true } } },
      orderBy: { dataHora: "asc" },
    });
    return reply.send(tarefas);
  });

  fastify.patch<{ Params: { id: string } }>("/tarefas/:id", async (request, reply) => {
    const parsed = patchTarefaBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Status inválido." });
    }
    try {
      const tarefa = await prisma.tarefa.update({
        where: { id: request.params.id },
        data: { status: parsed.data.status },
      });
      return reply.send(tarefa);
    } catch {
      return reply.code(404).send({ error: "Tarefa não encontrada." });
    }
  });

  // ---------------- Dashboard ----------------

  fastify.get("/dashboard/resumo", async (_request, reply) => {
    const [porEtapa, reunioesPendentes, tentativasHoje] = await Promise.all([
      prisma.negociacao.groupBy({ by: ["etapa"], _count: { _all: true } }),
      prisma.tarefa.count({ where: { tipo: "reuniao", status: "PENDENTE" } }),
      prisma.tentativaLigacao.count({
        where: { iniciadaEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    return reply.send({ porEtapa, reunioesPendentes, tentativasHoje });
  });
}
