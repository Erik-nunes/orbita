import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/lib/dates";
import { getKpis, getBreakdowns, getSellerTable } from "@/lib/metrics";
import PeriodFilter from "@/components/PeriodFilter";
import ReportsView from "@/components/ReportsView";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const period = resolvePeriod(searchParams.periodo, searchParams.de, searchParams.ate);
  const [kpis, breakdowns, sellerTable, sales, lostLeads] = await Promise.all([
    getKpis(period),
    getBreakdowns(period),
    getSellerTable(period),
    prisma.sale.findMany({
      where: { deletedAt: null, soldAt: { gte: period.from, lte: period.to } },
      orderBy: { soldAt: "desc" },
      include: { lead: { select: { name: true, company: true } }, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, stage: "Perdido", updatedAt: { gte: period.from, lte: period.to } },
      include: { owner: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <p className="muted text-sm">Consolidado do período selecionado, com exportação em CSV/Excel e impressão em PDF.</p>
      </div>
      <PeriodFilter />
      <ReportsView
        periodLabel={period.label}
        kpis={JSON.parse(JSON.stringify(kpis))}
        breakdowns={JSON.parse(JSON.stringify(breakdowns))}
        sellerTable={JSON.parse(JSON.stringify(sellerTable))}
        sales={JSON.parse(JSON.stringify(sales))}
        lostLeads={JSON.parse(JSON.stringify(lostLeads))}
      />
    </div>
  );
}
