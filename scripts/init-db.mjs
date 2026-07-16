// Cria o banco SQLite local a partir de prisma/init.sql.
// Alternativa offline ao `npx prisma db push` (que exige internet na 1a vez).
import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
if (!url.startsWith("file:")) {
  console.log("DATABASE_URL não é SQLite — use `npx prisma db push` para o PostgreSQL.");
  process.exit(0);
}
const path = url.replace(/^file:/, "").replace(/^\.\//, "");
const dbPath = path.startsWith("prisma/") || path.startsWith("/") ? path : `prisma/${path}`;
mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.exec(readFileSync("prisma/init.sql", "utf8"));
db.close();
console.log(`✔ Banco SQLite pronto em ${dbPath}`);
