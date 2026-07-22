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
      redact: ["req.headers.authorization", "req.headers['x-api-key']"],
    },
  });

  // ---- 1. REGISTRO DO CORS (Sempre em primeiro!) ----
  // Limpa trailing slashes do .env
  const allowedOrigin = env.CORS_ORIGIN
    ? env.CORS_ORIGIN.replace(/\/$/, "")
    : "https://frontend-eduarda.vercel.app";

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Libera se não houver origin (Insomnia, cURL, etc)
      if (!origin) {
        cb(null, true);
        return;
      }

      const cleanOrigin = origin.replace(/\/$/, "");

      // Verifica se bate exatamente com a origin do .env ou se é o frontend da Vercel
      if (cleanOrigin === allowedOrigin || cleanOrigin === "https://frontend-eduarda.vercel.app") {
        cb(null, true);
        return;
      }

      // IMPORTANTE: Retornamos null e false em vez de disparar new Error()
      // Isso evita que o Fastify gere status 500 sem os cabeçalhos de CORS
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "ngrok-skip-browser-warning",
      "Access-Control-Allow-Origin"
    ],
  });

  // ---- 2. HELMET (Ajustado para não bloquear Cross-Origin) ----
  await fastify.register(helmet, {
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });

  // ---- 3. RATE LIMIT ----
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // ---- 4. PLUGINS DE AUTENTICAÇÃO ----
  await fastify.register(authPlugin);
  await fastify.register(apiKeyPlugin);

  // ---- 5. ROTAS ----
  await fastify.register(authRoutes);
  await fastify.register(crmRoutes);
  await fastify.register(discagemRoutes);
  await fastify.register(webhookRoutes);

  // ---- Health Check ----
  fastify.get("/health", async () => ({ status: "ok" }));

  try {
    await fastify.listen({ port: Number(env.PORT) || 3000, host: "0.0.0.0" });
    fastify.log.info(`Servidor rodando na porta ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();