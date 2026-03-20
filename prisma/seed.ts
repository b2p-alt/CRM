import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 12);

  const master = await prisma.user.upsert({
    where: { email: "admin@crm.pt" },
    update: {},
    create: {
      nome: "Administrador",
      email: "admin@crm.pt",
      password,
      role: UserRole.MASTER,
    },
  });

  console.log("✓ User Master criado:", master.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
