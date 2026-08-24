import type { FastifyReply, FastifyRequest } from "fastify";
import {
  decisorBody,
  gatekeeperBody,
} from "../schemas/webhooks.schemas.js";
import { webhookService } from "../services/webhook.service.js";

export async function gatekeeperController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = gatekeeperBody.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
  }

  try {
    return reply.send(await webhookService.registrarGatekeeper(parsed.data));
  } catch (error) {
    if (error instanceof Error && error.message === "NEGOCIACAO_NAO_ENCONTRADA") {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }
    throw error;
  }
}

export async function decisorController(request: FastifyRequest, reply: FastifyReply) {
  const parsed = decisorBody.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Dados inválidos.", detalhes: parsed.error.flatten() });
  }

  try {
    const result = await webhookService.registrarDecisor(parsed.data);
    return reply.send({ status: "registrado", ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "NOME_DECISOR_OBRIGATORIO") {
      return reply.code(400).send({ error: "Informe nomeDecisor ou nome_contato." });
    }
    if (error instanceof Error && error.message === "NEGOCIACAO_NAO_ENCONTRADA") {
      return reply.code(404).send({ error: "Negociação não encontrada." });
    }
    if (error instanceof Error && error.message === "NOME_EMPRESA_OBRIGATORIO") {
      return reply.code(400).send({ error: "nome_empresa é obrigatório quando negociacaoId é nulo." });
    }
    throw error;
  }
}
