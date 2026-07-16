import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "@/components/KanbanBoard";

export const dynamic = "force-dynamic";

export default async function FunilPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...(isAdmin ? {} : { ownerId: user.id }) },
    orderBy: { updatedAt: "desc" },
    include: { owner: { select: { name: true } } },
    take: 1000,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Funil de vendas</h1>
        <p className="muted text-sm">Arraste os cartões entre as etapas. Cada movimentação fica registrada no histórico.</p>
      </div>
      <KanbanBoard leads={JSON.parse(JSON.stringify(leads))} />
    </div>
  );
}
