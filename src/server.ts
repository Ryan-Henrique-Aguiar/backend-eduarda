import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import { env } from "./lib/env.js";
import authPlugin from "./plugins/auth.js";
import apiKeyPlugin from "./plugins/apiKey.js";

import { authRoutes } from "./routes/auth.routes.js";
import { crmRoutes } from "./routes/crm.routes.js";
import { discagemRoutes } from "./routes/discagem.routes.js";
import { webhookRoutes } from "./routes/webhooks.routes.js";

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      // Nunca logar corpo de requisição por padrão — pode conter dados de contato
      redact: ["req.headers.authorization", "req.headers['x-api-key']"],
    },
  });

  // ---- Segurança de borda ----
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ---- Autenticação ----
  await fastify.register(authPlugin);
  await fastify.register(apiKeyPlugin);

  // ---- Rotas ----
  await fastify.register(authRoutes);
  await fastify.register(crmRoutes);
  await fastify.register(discagemRoutes);
  await fastify.register(webhookRoutes);

  fastify.get("/health", async () => ({ status: "ok" }));

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    fastify.log.info(`Servidor rodando na porta ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
