import type { Prisma, PrismaClient } from "@prisma/client";

export type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

export class WebhookRepository {
  constructor(private readonly db: PrismaExecutor) {}

  findNegociacaoById(id: string) {
    return this.db.negociacao.findUnique({ where: { id } });
  }

  findNegociacaoContext(id: string) {
    return this.db.negociacao.findUnique({
      where: { id },
      include: { empresa: true, contato: true },
    });
  }

  createTentativa(data: Prisma.TentativaLigacaoCreateInput) {
    return this.db.tentativaLigacao.create({ data });
  }

  updateNegociacao(id: string, data: Prisma.NegociacaoUpdateInput) {
    return this.db.negociacao.update({ where: { id }, data });
  }

  findDecisor(empresaId: string, nome: string) {
    return this.db.contato.findFirst({
      where: { empresaId, nome: { equals: nome, mode: "insensitive" } },
    });
  }

  updateEmpresaTelefone(id: string, telefonePrincipal: string) {
    return this.db.empresa.update({ where: { id }, data: { telefonePrincipal } });
  }

  updateContato(id: string, data: Prisma.ContatoUpdateInput) {
    return this.db.contato.update({ where: { id }, data });
  }

  createContato(data: Prisma.ContatoCreateInput) {
    return this.db.contato.create({ data });
  }

  createInteracao(data: Prisma.InteracaoEduardaCreateInput) {
    return this.db.interacaoEduarda.create({ data });
  }

  createTarefa(data: Prisma.TarefaCreateInput) {
    return this.db.tarefa.create({ data });
  }

  findEmpresaByName(nome: string) {
    return this.db.empresa.findFirst({
      where: { nome: { equals: nome, mode: "insensitive" } },
    });
  }

  updateEmpresa(id: string, data: Prisma.EmpresaUpdateInput) {
    return this.db.empresa.update({ where: { id }, data });
  }

  createEmpresa(data: Prisma.EmpresaCreateInput) {
    return this.db.empresa.create({ data });
  }

  findContato(empresaId: string, email?: string, telefone?: string, nome?: string) {
    return this.db.contato.findFirst({
      where: {
        empresaId,
        OR: [
          ...(email ? [{ email }] : []),
          ...(telefone ? [{ telefone }] : []),
          ...(nome ? [{ nome: { equals: nome, mode: "insensitive" as const } }] : []),
        ],
      },
    });
  }
}
