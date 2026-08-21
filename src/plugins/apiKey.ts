import fp from "fastify-plugin";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../lib/env.js";
import { isValidApiKey } from "../security/api-key.security.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticateService: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async (fastify) => {
  fastify.decorate(
    "authenticateService",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apiKey = request.headers["x-api-key"] as string | undefined;

      if (!isValidApiKey(apiKey, env.SERVICE_API_KEY)) {
        reply.code(401).send({ error: "API key ausente ou inválida." });
      }
    }
  );
});
