import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, businessDaysRemaining, businessDaysElapsed, businessDaysInMonth } from "@/lib/dates";
import { getKpis, getGoals, getTodayRevenue, getMonthRevenue, getDailySeries, getBreakdowns, getSellerTable } from "@/lib/metrics";
import { BRL, BRL2, PCT, STAGES } from "@/lib/constants";
import PeriodFilter from "@/components/PeriodFilter";
import KpiCard from "@/components/KpiCard";
import GoalBar from "@/components/GoalBar";
import DailyGoalCard from "@/components/DailyGoalCard";
import RevenueCumulativeChart from "@/components/charts/RevenueCumulativeChart";
import DailyActivityChart from "@/components/charts/DailyActivityChart";
import HBarList from "@/components/charts/HBarList";
import FunnelChart from "@/components/charts/FunnelChart";
import QuickActions from "@/components/QuickActions";
import { startOfDay, subDays, format, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend } from "date-fns";

export const dynamic = "force-dynamic";

function delta(curr: number, prev: number) {
  if (!prev) return null;
  return (curr - prev) / prev;
}

export default async function DashboardPage({
  searchParams,
}: { searchParams: { [k: string]: string | undefined } }) {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  const period = resolvePeriod(searchParams.periodo, searchParams.de, searchParams.ate);
  const prev = previousPeriod(period);
  const sellerFilter = isAdmin ? searchParams.vendedor || undefined : user.id;

  const [kpis, kpisPrev, goals, today, month, series, breakdowns] = await Promise.all([
    getKpis(period, sellerFilter),
    getKpis(prev, sellerFilter),
    getGoals(isAdmin && !searchParams.vendedor ? undefined : sellerFilter),
    getTodayRevenue(sellerFilter),
    getMonthRevenue(sellerFilter),
    getDailySeries(period, sellerFilter),
    getBreakdowns(period, sellerFilter),
  ]);

  // ---- meta mensal (ritmo esperado por dia útil) ----
  const now = new Date();
  const bdTotal = businessDaysInMonth(now);
  const bdElapsed = businessDaysElapsed(now) + (isWeekend(now) ? 0 : 1); // conta o dia de hoje
  const bdRemaining = Math.max(businessDaysRemaining(now), 1);
  const expectedPct = Math.min(bdElapsed / bdTotal, 1);
  const neededPerDay = Math.max(goals.monthly - month.total, 0) / bdRemaining;
  const dailyAvg = bdElapsed > 0 ? month.total / bdElapsed : 0;
  const projection = month.total + dailyAvg * (bdRemaining - (isWeekend(now) ? 0 : 1));

  // ---- faturamento acumulado x ideal ----
  const monthDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  let acc = 0;
  let idealAcc = 0;
  const idealStep = goals.monthly / bdTotal;
  const cumulative = monthDays.map((d) => {
    const daySales = month.sales.filter((s) => format(s.soldAt, "yyyy-MM-dd") === format(d, "yyyy-MM-dd"));
    acc += daySales.reduce((t, s) => t + s.totalValue, 0);
    if (!isWeekend(d)) idealAcc += idealStep;
    return {
      date: format(d, "dd/MM"),
      realizado: d <= now ? Math.round(acc) : NaN as unknown as number,
      ideal: Math.round(idealAcc),
    };
  });

  // ---- funil (leads ativos por etapa) ----
  const stageWhere: any = { deletedAt: null };
  if (sellerFilter) stageWhere.ownerId = sellerFilter;
  const leadsByStageRaw = await prisma.lead.groupBy({ by: ["stage"], where: stageWhere, _count: true });
  const funnel = STAGES.map((s) => ({
    stage: s,
    count: leadsByStageRaw.find((r) => r.stage === s)?._count ?? 0,
  }));

  // ---- alertas ----
  const twoDaysAgo = subDays(startOfDay(now), 2);
  const alertWhere: any = { deletedAt: null, stage: { notIn: ["Venda fechada", "Perdido"] } };
  if (sellerFilter) alertWhere.ownerId = sellerFilter;
  const [staleLeads, hotNoNext] = await Promise.all([
    prisma.lead.count({ where: { ...alertWhere, OR: [{ lastContactAt: { lt: twoDaysAgo } }, { lastContactAt: null, createdAt: { lt: twoDaysAgo } }] } }),
    prisma.lead.count({ where: { ...alertWhere, temperature: "Quente", nextContactAt: null } }),
  ]);
  const alerts: { tone: "warn" | "bad" | "good"; text: string }[] = [];
  if (today.value < goals.daily) alerts.push({ tone: "warn", text: `Meta diária ainda não atingida — faltam ${BRL(goals.daily - today.value)}.` });
  else alerts.push({ tone: "good", text: "Meta diária atingida! 🎯" });
  if (staleLeads > 0) alerts.push({ tone: "bad", text: `${staleLeads} lead(s) sem contato há mais de 2 dias.` });
  if (hotNoNext > 0) alerts.push({ tone: "warn", text: `${hotNoNext} lead(s) quente(s) sem próxima ação agendada.` });
  if (month.total / goals.monthly < expectedPct * 0.8) alerts.push({ tone: "bad", text: "Faturamento do mês abaixo do ritmo esperado para a data." });

  // ---- dados para admin ----
  const sellers = isAdmin
    ? await prisma.user.findMany({ where: { role: "SELLER", deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const sellerTable = isAdmin ? await getSellerTable(period) : [];

  // leads do usuário para ações rápidas (vendedor)
  const myLeads = !isAdmin
    ? await prisma.lead.findMany({
        where: { ownerId: user.id, deletedAt: null },
        select: { id: true, name: true, company: true },
        orderBy: { updatedAt: "desc" }, take: 200,
      })
    : [];
  const needFollowUp = !isAdmin
    ? await prisma.lead.findMany({
        where: {
          ownerId: user.id, deletedAt: null, stage: { notIn: ["Venda fechada", "Perdido"] },
          OR: [{ nextContactAt: { lte: now } }, { lastContactAt: { lt: twoDaysAgo } }, { lastContactAt: null }],
        },
        orderBy: { nextContactAt: "asc" }, take: 6,
      })
    : [];

  const revenueMode = searchParams.faturamento === "recebido" ? "recebido" : "vendido";
  const shownRevenue = revenueMode === "recebido" ? kpis.receivedRevenue : kpis.revenue;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {isAdmin ? "Visão geral da agência" : `Olá, ${user.name.split(" ")[0]} 👋`}
          </h1>
          <p className="muted text-sm">
            {isAdmin ? `Desempenho comercial — ${period.label.toLowerCase()}` : "Aqui está o seu dia de vendas."}
          </p>
        </div>
        {isAdmin && (
          <a
            href={`/dashboard?${new URLSearchParams({ ...Object.fromEntries(Object.entries(searchParams).filter(([, v]) => v) as any), faturamento: revenueMode === "recebido" ? "vendido" : "recebido" })}`}
            className="btn-ghost text-xs"
          >
            Critério: {revenueMode === "recebido" ? "valores recebidos" : "valor total vendido"} · trocar
          </a>
        )}
      </div>

      <PeriodFilter sellers={isAdmin ? sellers : undefined} />

      {/* metas */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GoalBar
            goal={goals.monthly}
            current={month.total}
            expectedPct={expectedPct}
            remainingDays={bdRemaining}
            neededPerDay={neededPerDay}
            projection={projection}
          />
        </div>
        <DailyGoalCard goal={goals.daily} sold={today.value} count={today.count} />
      </div>

      {/* alertas */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <span key={i} className={`badge !px-3 !py-1.5 !text-xs
              ${a.tone === "good" ? "bg-mint-500/15 text-mint-600" : a.tone === "warn" ? "bg-amber-500/15 text-amber-500" : "bg-coral-500/15 text-coral-500"}`}>
              {a.text}
            </span>
          ))}
        </div>
      )}

      {/* ações rápidas do vendedor */}
      {!isAdmin && <QuickActions leads={myLeads} />}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        <KpiCard title="Contatos realizados" value={String(kpis.contacts)} delta={delta(kpis.contacts, kpisPrev.contacts)} icon="✆" hint="vs. período anterior" />
        <KpiCard title="Leads cadastrados" value={String(kpis.leads)} delta={delta(kpis.leads, kpisPrev.leads)} icon="◎" hint="vs. período anterior" />
        <KpiCard title="Leads qualificados" value={String(kpis.qualifiedLeads)} delta={delta(kpis.qualifiedLeads, kpisPrev.qualifiedLeads)} icon="✦" tone="good" hint="qualificados + prioritários" />
        <KpiCard title="Propostas enviadas" value={String(kpis.proposals)} delta={delta(kpis.proposals, kpisPrev.proposals)} icon="✉" />
        <KpiCard title="Vendas fechadas" value={String(kpis.salesCount)} delta={delta(kpis.salesCount, kpisPrev.salesCount)} icon="◈" tone="good" />
        <KpiCard title={`Faturamento (${revenueMode})`} value={BRL(shownRevenue)} delta={delta(kpis.revenue, kpisPrev.revenue)} icon="R$" tone="good" />
        <KpiCard title="Ticket médio" value={kpis.avgTicket ? BRL2(kpis.avgTicket) : "—"} delta={delta(kpis.avgTicket, kpisPrev.avgTicket)} icon="◧" />
        <KpiCard title="Taxa de conversão" value={PCT(kpis.conversion)} delta={delta(kpis.conversion, kpisPrev.conversion)} icon="%" tone={kpis.conversion >= 0.1 ? "good" : "warn"} hint="vendas ÷ leads" />
        <KpiCard title="Valor em negociação" value={BRL(kpis.pipelineValue)} icon="⏳" tone="warn" hint="orçamentos no funil ativo" />
        <KpiCard title="Faturamento hoje" value={BRL(today.value)} icon="☀" tone={today.value >= goals.daily ? "good" : "warn"} hint={`meta ${BRL(goals.daily)}`} />
        <KpiCard title="Faturamento do mês" value={BRL(month.total)} icon="▤" tone="good" hint={`recebido: ${BRL(month.received)}`} />
        <KpiCard title="Respostas / reuniões" value={`${kpis.replies} / ${kpis.meetings}`} icon="⇄" hint="no período" />
      </div>

      {/* gráficos principais */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display font-bold mb-1">Faturamento acumulado no mês</h2>
          <p className="text-xs muted mb-3">Realizado vs. ritmo ideal para {BRL(goals.monthly)}</p>
          <RevenueCumulativeChart data={cumulative} />
        </div>
        <div className="card p-5">
          <h2 className="font-display font-bold mb-1">Atividade por dia</h2>
          <p className="text-xs muted mb-3">Contatos, leads, qualificados e vendas — {period.label.toLowerCase()}</p>
          <DailyActivityChart data={series} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="font-display font-bold mb-3">Leads por origem</h2>
          <HBarList items={breakdowns.leadsBySource} />
        </div>
        <div className="card p-5">
          <h2 className="font-display font-bold mb-3">Vendas por serviço</h2>
          <HBarList items={breakdowns.salesByService} money />
        </div>
        <div className="card p-5">
          <h2 className="font-display font-bold mb-3">Motivos de perda</h2>
          <HBarList items={breakdowns.lostReasons} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-display font-bold mb-3">Funil de vendas — leads por etapa</h2>
          <FunnelChart data={funnel} />
        </div>
        <div className="card p-5">
          <h2 className="font-display font-bold mb-3">
            {isAdmin ? "Faturamento por vendedor" : "Leads que precisam de retorno"}
          </h2>
          {isAdmin ? (
            <HBarList items={breakdowns.revenueBySeller} money />
          ) : needFollowUp.length ? (
            <ul className="divide-y hairline">
              {needFollowUp.map((l) => (
                <li key={l.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{l.name}{l.company ? ` — ${l.company}` : ""}</div>
                    <div className="text-xs muted">
                      {l.lastContactAt ? `Último contato: ${format(l.lastContactAt, "dd/MM")}` : "Nunca contatado"} · {l.stage}
                    </div>
                  </div>
                  <span className={`badge shrink-0 ${l.temperature === "Quente" ? "bg-coral-500/15 text-coral-500" : l.temperature === "Morno" ? "bg-amber-500/15 text-amber-500" : "bg-brand-500/10 text-brand-600"}`}>
                    {l.temperature}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm muted py-6 text-center">Tudo em dia! Nenhum lead aguardando retorno. ✅</p>
          )}
        </div>
      </div>

      {/* painel de vendedores (admin) */}
      {isAdmin && (
        <div className="card overflow-x-auto">
          <div className="px-5 pt-5 pb-2 flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold">Desempenho dos vendedores</h2>
              <p className="text-xs muted">{period.label} · clique em Equipe e metas para gerenciar</p>
            </div>
          </div>
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr>
                <th className="th pl-5">Vendedor</th><th className="th">Contatos</th><th className="th">Leads</th>
                <th className="th">Qualif.</th><th className="th">Reuniões</th><th className="th">Propostas</th>
                <th className="th">Vendas</th><th className="th">Faturamento</th><th className="th">Ticket</th>
                <th className="th">Conversão</th><th className="th">% Meta</th><th className="th pr-5">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {sellerTable.map((s) => (
                <tr key={s.id} className="hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                  <td className="td pl-5 font-semibold">{s.name}{!s.active && <span className="badge bg-coral-500/15 text-coral-500 ml-2">bloqueado</span>}</td>
                  <td className="td tabular-nums">{s.contacts}</td>
                  <td className="td tabular-nums">{s.leads}</td>
                  <td className="td tabular-nums">{s.qualifiedLeads}</td>
                  <td className="td tabular-nums">{s.meetings}</td>
                  <td className="td tabular-nums">{s.proposals}</td>
                  <td className="td tabular-nums font-semibold">{s.salesCount}</td>
                  <td className="td tabular-nums font-semibold">{BRL(s.revenue)}</td>
                  <td className="td tabular-nums">{s.avgTicket ? BRL(s.avgTicket) : "—"}</td>
                  <td className="td tabular-nums">{PCT(s.conversion)}</td>
                  <td className="td">
                    <span className={`badge ${s.goalPct >= 1 ? "bg-mint-500/15 text-mint-600" : s.goalPct >= 0.6 ? "bg-amber-500/15 text-amber-500" : "bg-coral-500/15 text-coral-500"}`}>
                      {(s.goalPct * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="td pr-5 muted">{s.lastActivity ? format(s.lastActivity, "dd/MM HH:mm") : "—"}</td>
                </tr>
              ))}
              {sellerTable.length === 0 && (
                <tr><td colSpan={12} className="td text-center muted py-8">Nenhum vendedor cadastrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
