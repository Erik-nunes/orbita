import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay } from "date-fns";
import ContactsView from "@/components/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContatosPage() {
  const session = await getServerSession(authOptions);
  const user = session!.user;
  const isAdmin = user.role === "ADMIN";
  const scope = isAdmin ? {} : { userId: user.id };

  const [contacts, leads, todayCount] = await Promise.all([
    prisma.contact.findMany({
      where: { deletedAt: null, ...scope },
      orderBy: { happenedAt: "desc" },
      take: 300,
      include: {
        lead: { select: { id: true, name: true, company: true, whatsapp: true, phone: true, email: true } },
        user: { select: { name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ...(isAdmin ? {} : { ownerId: user.id }) },
      select: { id: true, name: true, company: true },
      orderBy: { updatedAt: "desc" }, take: 300,
    }),
    prisma.contact.count({ where: { deletedAt: null, ...scope, happenedAt: { gte: startOfDay(new Date()) } } }),
  ]);

  return (
    <ContactsView
      contacts={JSON.parse(JSON.stringify(contacts))}
      leads={leads}
      todayCount={todayCount}
      isAdmin={isAdmin}
    />
  );
}
