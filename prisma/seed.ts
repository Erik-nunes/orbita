// Seed de PRODUÇÃO: cria apenas o administrador master e a meta do mês.
// Nenhum dado de demonstração é criado.
// Personalize via .env: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = url.startsWith("file:")
  ? new PrismaBetterSqlite3({ url })
  : new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const ADMIN_NAME = process.env.ADMIN_NAME ?? "Administrador";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@agencia.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`ℹ Administrador já existe (${ADMIN_EMAIL}). Nada foi alterado.`);
    return;
  }

  await prisma.user.create({
    data: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "ADMIN",
    },
  });

  const now = new Date();
  await prisma.goal.upsert({
    where: {
      scope_userId_month_year: {
        scope: "TEAM", userId: null as any,
        month: now.getMonth() + 1, year: now.getFullYear(),
      },
    },
    create: {
      scope: "TEAM", month: now.getMonth() + 1, year: now.getFullYear(),
      monthlyValue: 50000, dailyValue: 2000,
    },
    update: {},
  }).catch(async () => {
    await prisma.goal.create({
      data: { scope: "TEAM", month: now.getMonth() + 1, year: now.getFullYear(), monthlyValue: 50000, dailyValue: 2000 },
    });
  });

  console.log("✅ Sistema pronto para uso!");
  console.log(`   Acesso do administrador: ${ADMIN_EMAIL} · ${ADMIN_PASSWORD}`);
  console.log("   ⚠ Troque a senha padrão criando seu usuário definitivo em Equipe e metas.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
