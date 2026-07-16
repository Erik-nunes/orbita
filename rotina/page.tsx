import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import { getGoals } from "@/lib/metrics";
import DailyCloseForm from "@/components/DailyCloseForm";
import { BRL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RotinaPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const now = new Date();
  const range = { gte: startOfDay(now), lte: endOfDay(now) };

  // numeros calculados automaticamente com base nas atividades de hoje
  const [contacts, replies, meetings, newLeads, qualified, proposals, sales, existing, goals, tasks] =
    await Promise.all([
      prisma.contact.count({ where: { userId: user.id, deletedAt: null, happenedAt: range } }),
      prisma.contact.count({
        where: { userId: user.id, deletedAt: null, happenedAt: range,
          result: { in: ["Respondeu", "Demonstrou interesse", "Solicitou proposta", "Agendou reunião"] } },
      }),
      prisma.contact.count({ where: { userId: user.id, deletedAt: null, happenedAt: range, result: "Agendou reunião" } }),
      prisma.lead.count({ where: { ownerId: user.id, deletedAt: null, createdAt: range } }),
      prisma.lead.count({
        where: { ownerId: user.id, deletedAt: null, updatedAt: range, qualification: { in: ["Qualificado", "Prioritário"] } },
      }),
      prisma.proposal.count({ where: { userId: user.id, deletedAt: null, sentAt: range } }),
      prisma.sale.findMany({
        where: { userId: user.id, deletedAt: null, soldAt: range, paymentStatus: { not: "Cancelado" } },
        select: { totalValue: true },
      }),
      prisma.dailyReport.findUnique({ where: { userId_date: { userId: user.id, date: startOfDay(now) } } }),
      getGoals(user.role === "ADMIN" ? undefined : user.id),
      prisma.lead.findMany({
        where: {
          ownerId: user.id, deletedAt: null, stage: { notIn: ["Venda fechada", "Perdido"] },
          nextContactAt: { lte: endOfDay(now) },
        },
        orderBy: { nextContactAt: "asc" }, take: 10,
      }),
    ]);

  const revenue = sales.reduce((t, s) => t + s.totalValue, 0);
  const auto = { contacts, replies, meetings, newLeads, qualified, proposals, sales: sales.length, revenue };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold">Minha rotina — fechamento diário</h1>
        <p className="muted text-sm">
          Os números abaixo foram calculados automaticamente com base nas suas atividades de hoje.
          Confira, ajuste se necessário e envie o fechamento.
        </p>
      </div>

      <div className={`card p-4 flex items-center gap-3 ${revenue >= goals.daily ? "!border-mint-500/40" : ""}`}>
        <span className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg
          ${revenue >= goals.daily ? "bg-mint-500/15 text-mint-600" : "bg-amber-500/15 text-amber-500"}`}>
          {revenue >= goals.daily ? "✓" : "◷"}
        </span>
        <div className="text-sm">
          <b>{BRL(revenue)}</b> vendidos hoje de uma meta de <b>{BRL(goals.daily)}</b>.{" "}
          {revenue >= goals.daily ? "Meta diária atingida! 🎯" : `Faltam ${BRL(goals.daily - revenue)}.`}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="card p-4">
          <h2 className="font-display font-bold text-sm mb-2">Retornos agendados para hoje</h2>
          <ul className="space-y-1 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className="flex justify-between gap-2">
                <span className="truncate">{t.name}{t.company ? ` — ${t.company}` : ""}</span>
                <span className="muted shrink-0">{t.stage}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DailyCloseForm auto={auto} existing={existing ? JSON.parse(JSON.stringify(existing)) : null} />
    </div>
  );
}
