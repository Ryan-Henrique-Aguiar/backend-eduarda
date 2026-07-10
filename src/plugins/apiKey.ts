import fp from "fastify-plugin";
import crypto from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../lib/env.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticateService: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Comparação em tempo constante para evitar timing attack na API key
function isValidApiKey(provided: string | undefined): boolean {
  if (!provided) return false;

  const expected = Buffer.from(env.SERVICE_API_KEY);
  const received = Buffer.from(provided);

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

export default fp(async (fastify) => {
  fastify.decorate(
    "authenticateService",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = request.headers["x-api-key"] as string | undefined;

      if (!isValidApiKey(apiKey)) {
        reply.code(401).send({ error: "API key ausente ou inválida." });
      }
    }
  );
});
