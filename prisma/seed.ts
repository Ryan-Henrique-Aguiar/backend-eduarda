import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const senha = process.env.ADMIN_PASSWORD;

  if (!email || !senha) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no .env antes de rodar o seed.");
  }

  const senhaHash = await bcrypt.hash(senha, 12);

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: { senhaHash },
    create: {
      nome: "Administrador",
      email,
      senhaHash,
      papel: "ADMIN",
    },
  });

  console.log(`Usuário admin pronto: ${usuario.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
