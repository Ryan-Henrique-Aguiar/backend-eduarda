import type { FastifyInstance } from "fastify";
import {
  decisorController,
  dialerStatusController,
  gatekeeperController,
} from "../controllers/webhook.controller.js";

export async function webhookRoutes(fastify: FastifyInstance) {
  // Todas as rotas aqui são chamadas por serviços (Dialer, Eduarda), não por humanos
  fastify.addHook("preHandler", fastify.authenticateService);

  fastify.post("/webhooks/dialer/status", dialerStatusController);
  fastify.post("/webhooks/eduarda/gatekeeper", gatekeeperController);
  fastify.post("/webhooks/eduarda/decisor", decisorController);
}
