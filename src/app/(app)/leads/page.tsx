import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LeadsTable from "@/components/LeadsTable";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  const [leads, sellers] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, ...(isAdmin ? {} : { ownerId: user.id }) },
      orderBy: { updatedAt: "desc" },
      include: { owner: { select: { id: true, name: true } } },
      take: 1000,
    }),
    isAdmin
      ? prisma.user.findMany({ where: { role: "SELLER", deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Leads</h1>
        <p className="muted text-sm">{isAdmin ? "Todos os leads da agência." : "Seus leads e oportunidades."}</p>
      </div>
      <LeadsTable
        leads={JSON.parse(JSON.stringify(leads))}
        sellers={sellers}
        isAdmin={isAdmin}
      />
    </div>
  );
}
