import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/dates";
import { getSellerTable } from "@/lib/metrics";
import { startOfDay } from "date-fns";
import TeamView from "@/components/TeamView";
import PeriodFilter from "@/components/PeriodFilter";

export const dynamic = "force-dynamic";

export default async function EquipePage({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const period = resolvePeriod(searchParams.periodo, searchParams.de, searchParams.ate);
  const [rows, users, reportsToday, logs] = await Promise.all([
    getSellerTable(period),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, active: true, monthlyGoal: true, dailyGoal: true },
    }),
    prisma.dailyReport.findMany({ where: { date: startOfDay(new Date()) }, select: { userId: true } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" }, take: 30,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Equipe e metas</h1>
        <p className="muted text-sm">Gerencie vendedores, acompanhe o ranking e o log de alterações.</p>
      </div>
      <PeriodFilter />
      <TeamView
        rows={JSON.parse(JSON.stringify(rows))}
        users={JSON.parse(JSON.stringify(users.filter((u) => u.role === "SELLER")))}
        reportedToday={reportsToday.map((r) => r.userId)}
        logs={JSON.parse(JSON.stringify(logs))}
        periodLabel={period.label}
      />
    </div>
  );
}
