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

const STAGES = [
  "Lead cadastrado","Em análise","Lead qualificado","Primeiro contato","Em conversa",
  "Reunião agendada","Diagnóstico realizado","Proposta enviada","Negociação",
  "Aguardando resposta","Venda fechada","Perdido",
];
const SOURCES = ["Instagram","Indicação","Google","Prospecção ativa","WhatsApp","Site","LinkedIn"];
const SERVICES = ["Landing page","Site institucional","Loja virtual","Página de vendas","Manutenção","Identidade visual"];
const CHANNELS = ["WhatsApp","Ligação","Instagram","E-mail","LinkedIn"];
const RESULTS = ["Não respondeu","Respondeu","Demonstrou interesse","Solicitou proposta","Agendou reunião","Sem interesse","Retornar depois"];
const SEGMENTS = ["Restaurante","Clínica odontológica","Advocacia","Loja de roupas","Academia","Imobiliária","Pet shop","Salão de beleza","Construtora","Contabilidade"];
const CITIES: [string, string][] = [["Montes Claros","MG"],["Belo Horizonte","MG"],["Uberlândia","MG"],["São Paulo","SP"],["Goiânia","GO"],["Brasília","DF"]];
const FIRST = ["Carlos","Fernanda","João","Mariana","Pedro","Juliana","Rafael","Camila","Lucas","Patrícia","Bruno","Aline","Diego","Renata","Gustavo","Larissa","Thiago","Vanessa","Eduardo","Beatriz","Marcelo","Tatiane","Felipe","Simone"];
const LAST = ["Silva","Souza","Oliveira","Santos","Pereira","Costa","Rodrigues","Almeida","Nascimento","Lima","Araújo","Ferreira"];
const COMPANIES = ["Sabor & Arte","Sorriso Ideal","Advocacia Prime","Moda Urbana","Corpo em Forma","Lar Imóveis","Amigo Pet","Bella Hair","Construmax","ContaCerta","Doce Encontro","Ótica Visão","AutoPeças Norte","Espaço Zen","Café Central","Studio Fit","TecnoInfo","Verde Jardim","Padaria Nova","Clínica Vida"];

function rand<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour + randInt(0, 7), randInt(0, 59), 0, 0);
  return d;
}
function isWeekend(d: Date) { const w = d.getDay(); return w === 0 || w === 6; }

async function main() {
  console.log("🌱 Populando o banco de dados...");

  // limpa (ordem por dependencias)
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.leadStageHistory.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();

  // usuarios
  const adminPass = await bcrypt.hash("admin123", 10);
  const sellerPass = await bcrypt.hash("vendas123", 10);

  const admin = await prisma.user.create({
    data: { name: "Marcos Andrade", email: "admin@agencia.com", passwordHash: adminPass, role: "ADMIN" },
  });
  const sellers = await Promise.all([
    prisma.user.create({ data: { name: "Ana Beatriz", email: "ana@agencia.com", passwordHash: sellerPass, role: "SELLER", monthlyGoal: 17000, dailyGoal: 700 } }),
    prisma.user.create({ data: { name: "Rafael Moreira", email: "rafael@agencia.com", passwordHash: sellerPass, role: "SELLER", monthlyGoal: 17000, dailyGoal: 700 } }),
    prisma.user.create({ data: { name: "Camila Duarte", email: "camila@agencia.com", passwordHash: sellerPass, role: "SELLER", monthlyGoal: 16000, dailyGoal: 600 } }),
  ]);

  // meta coletiva do mes atual
  const now = new Date();
  await prisma.goal.create({
    data: { scope: "TEAM", month: now.getMonth() + 1, year: now.getFullYear(), monthlyValue: 50000, dailyValue: 2000 },
  });

  // leads (~70, distribuidos nos ultimos 45 dias)
  const usedNames = new Set<string>();
  const leadRows: any[] = [];
  for (let i = 0; i < 70; i++) {
    let name = `${rand(FIRST)} ${rand(LAST)}`;
    while (usedNames.has(name)) name = `${rand(FIRST)} ${rand(LAST)}`;
    usedNames.add(name);
    const [city, state] = rand(CITIES);
    const owner = rand(sellers);
    const createdAt = daysAgo(randInt(0, 45));
    const stage = i < 15 ? "Venda fechada" : i < 21 ? rand(["Proposta enviada","Negociação","Aguardando resposta"]) : rand(STAGES);
    const service = rand(SERVICES);
    const budget = [1200, 1500, 1800, 2000, 2000, 2500, 3000, 3500, 4500, 6000][randInt(0, 9)];
    const qualification =
      ["Venda fechada","Proposta enviada","Negociação","Reunião agendada","Diagnóstico realizado"].includes(stage)
        ? (Math.random() > 0.3 ? "Qualificado" : "Prioritário")
        : rand(["Não analisado","Não qualificado","Qualificado","Qualificado","Prioritário"]);
    leadRows.push({
      name,
      company: rand(COMPANIES) + (Math.random() > 0.5 ? ` ${city.split(" ")[0]}` : ""),
      segment: rand(SEGMENTS), city, state,
      phone: `(38) 9${randInt(8000, 9999)}-${randInt(1000, 9999)}`,
      whatsapp: `(38) 9${randInt(8000, 9999)}-${randInt(1000, 9999)}`,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
      instagram: `@${name.toLowerCase().split(" ")[0]}${randInt(10, 99)}`,
      website: Math.random() > 0.6 ? "https://instagram.com/perfil" : null,
      source: rand(SOURCES), service, budget,
      temperature: stage === "Perdido" ? "Frio" : rand(["Frio","Morno","Morno","Quente"]),
      qualification,
      stage,
      lostReason: stage === "Perdido" ? rand(["Preço","Sem orçamento","Fechou com concorrente","Sem resposta","Adiou o projeto"]) : null,
      notes: Math.random() > 0.7 ? "Indicado por cliente atual. Quer referências de trabalhos no mesmo segmento." : null,
      tags: Math.random() > 0.7 ? "urgente" : null,
      ownerId: owner.id,
      createdAt,
      lastContactAt: Math.random() > 0.25 ? daysAgo(randInt(0, 6)) : null,
      nextContactAt: Math.random() > 0.5 ? daysAgo(-randInt(0, 4)) : null,
    });
  }
  for (const row of leadRows) await prisma.lead.create({ data: row });
  const leads = await prisma.lead.findMany();
  console.log(`  ✓ ${leads.length} leads`);

  // historico de etapas + contatos (ultimos 30 dias)
  let contactCount = 0;
  for (const lead of leads) {
    const idx = STAGES.indexOf(lead.stage);
    for (let s = 1; s <= Math.min(idx, 4); s++) {
      await prisma.leadStageHistory.create({
        data: { leadId: lead.id, fromStage: STAGES[s - 1], toStage: STAGES[s], userId: lead.ownerId, createdAt: daysAgo(randInt(1, 20)) },
      });
    }
    const n = randInt(0, 5);
    for (let c = 0; c < n; c++) {
      const happenedAt = daysAgo(randInt(0, 28));
      if (isWeekend(happenedAt)) continue;
      await prisma.contact.create({
        data: {
          leadId: lead.id, userId: lead.ownerId,
          channel: rand(CHANNELS), type: c === 0 ? "Primeiro contato" : "Follow-up",
          result: rand(RESULTS),
          note: Math.random() > 0.7 ? "Conversa boa, pediu para retomar na próxima semana." : null,
          nextAction: Math.random() > 0.6 ? "Enviar portfólio" : null,
          happenedAt,
        },
      });
      contactCount++;
    }
  }
  console.log(`  ✓ ${contactCount} contatos`);

  // propostas para leads em fase avancada
  const advanced = leads.filter((l) =>
    ["Proposta enviada","Negociação","Aguardando resposta","Venda fechada"].includes(l.stage));
  for (const lead of advanced) {
    await prisma.proposal.create({
      data: {
        leadId: lead.id, userId: lead.ownerId,
        service: lead.service ?? "Site institucional",
        value: lead.budget ?? 2000,
        status: lead.stage === "Venda fechada" ? "Aceita" : "Enviada",
        sentAt: daysAgo(randInt(1, 20)),
      },
    });
  }
  console.log(`  ✓ ${advanced.length} propostas`);

  // vendas: mes atual somando ~R$ 21.000 + mes anterior
  const closed = leads.filter((l) => l.stage === "Venda fechada");
  const values = [2000, 1800, 2500, 3000, 1500, 2200, 4000, 2000, 1700, 2600];
  let vi = 0;
  const day = now.getDate();
  for (const lead of closed) {
    const inThisMonth = vi < Math.min(closed.length, 9);
    const soldAt = inThisMonth ? daysAgo(randInt(0, Math.max(day - 1, 0))) : daysAgo(randInt(32, 44));
    const totalValue = values[vi % values.length];
    const down = Math.round(totalValue * 0.5);
    const status = rand(["Entrada paga","Entrada paga","Pago","Parcialmente pago"]);
    await prisma.sale.create({
      data: {
        leadId: lead.id, userId: lead.ownerId,
        service: lead.service ?? "Site institucional",
        totalValue, downPayment: down,
        receivedValue: status === "Pago" ? totalValue : down,
        paymentMethod: rand(["Pix","Cartão de crédito","Boleto"]),
        installments: rand([1, 2, 2, 3]),
        paymentStatus: status,
        soldAt,
        startAt: daysAgo(-randInt(2, 10)),
      },
    });
    vi++;
  }
  console.log(`  ✓ ${closed.length} vendas`);

  // fechamento diario de ontem para 2 vendedores
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  for (const s of sellers.slice(0, 2)) {
    await prisma.dailyReport.create({
      data: {
        userId: s.id, date: yesterday,
        contacts: randInt(8, 20), newLeads: randInt(1, 5), qualified: randInt(0, 3),
        replies: randInt(3, 10), meetings: randInt(0, 2), proposals: randInt(0, 2),
        sales: randInt(0, 1), revenue: rand([0, 0, 2000, 2500]),
        difficulties: "Muitos leads pedindo retorno na semana que vem.",
        priorities: "Fazer follow-up das propostas em aberto.",
      },
    });
  }

  console.log("✅ Seed concluído!");
  console.log("   Admin:    admin@agencia.com · admin123");
  console.log("   Vendedor: ana@agencia.com · vendas123 (também rafael@ e camila@)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
