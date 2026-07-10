import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limit mais restrito aqui, específico para tentativas de login
  fastify.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "E-mail ou senha inválidos." });
      }

      const { email, senha } = parsed.data;

      const usuario = await prisma.usuario.findUnique({ where: { email } });

      // Mensagem genérica de propósito: não revelar se o e-mail existe ou não
      if (!usuario) {
        return reply.code(401).send({ error: "Credenciais inválidas." });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
      if (!senhaValida) {
        return reply.code(401).send({ error: "Credenciais inválidas." });
      }

      const token = await reply.jwtSign({
        sub: usuario.id,
        email: usuario.email,
        papel: usuario.papel,
      });

      return reply.send({
        token,
        usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
      });
    }
  );

  // Rota protegida simples para o painel verificar se o token ainda é válido
  fastify.get(
    "/auth/me",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const usuario = await prisma.usuario.findUnique({
        where: { id: request.user.sub },
        select: { id: true, nome: true, email: true, papel: true },
      });

      if (!usuario) {
        return reply.code(404).send({ error: "Usuário não encontrado." });
      }

      return reply.send(usuario);
    }
  );
}
