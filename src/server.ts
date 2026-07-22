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

// Se você usa o Prisma no projeto, descomente a linha abaixo para testar o banco no /health:
// import { prisma } from "./lib/prisma.js"; // ajuste o caminho se necessário

async function main() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
      redact: ["req.headers.authorization", "req.headers['x-api-key']"],
    },
  });

  // ---- Segurança de borda ----
  await fastify.register(helmet);

  // ---- Tratamento da Origin do CORS ----
  // Remove qualquer barra '/' que venha no final da URL do .env para não quebrar a validação
  const formattedOrigin = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.replace(/\/$/, "")
    : "https://frontend-eduarda.vercel.app";

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Libera se for a origem configurada, sem origem (ex: Postman/cURL) ou se coincidir com o frontend
      if (!origin || origin.replace(/\/$/, "") === formattedOrigin) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "ngrok-skip-browser-warning", // <-- Crucial para o ngrok gratuito!
    ],
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

  // ---- Health Check (Com verificação de status da API) ----
  fastify.get("/health", async (request, reply) => {
    // Exemplo de teste simples no banco (se usar Prisma, descomente):
    /*
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch (error) {
      reply.status(500);
      return { status: "error", database: "disconnected", details: error.message };
    }
    */
    return { status: "ok" };
  });

  try {
    await fastify.listen({ port: Number(env.PORT) || 3000, host: "0.0.0.0" });
    fastify.log.info(`Servidor rodando na porta ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();