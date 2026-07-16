import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SalesView from "@/components/SalesView";

export const dynamic = "force-dynamic";

export default async function VendasPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";
  const scope = isAdmin ? {} : { userId: user.id };

  const [sales, proposals, leads] = await Promise.all([
    prisma.sale.findMany({
      where: { deletedAt: null, ...scope },
      orderBy: { soldAt: "desc" }, take: 300,
      include: { lead: { select: { name: true, company: true } }, user: { select: { name: true } } },
    }),
    prisma.proposal.findMany({
      where: { deletedAt: null, ...scope },
      orderBy: { sentAt: "desc" }, take: 300,
      include: { lead: { select: { name: true, company: true } }, user: { select: { name: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ...(isAdmin ? {} : { ownerId: user.id }) },
      select: { id: true, name: true, company: true },
      orderBy: { updatedAt: "desc" }, take: 300,
    }),
  ]);

  return (
    <SalesView
      sales={JSON.parse(JSON.stringify(sales))}
      proposals={JSON.parse(JSON.stringify(proposals))}
      leads={leads}
      isAdmin={isAdmin}
    />
  );
}
