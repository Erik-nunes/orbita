import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withUser, audit } from "@/lib/api";

const schema = z.object({
  leadId: z.string().min(1, "Selecione o cliente"),
  service: z.string().min(1),
  totalValue: z.coerce.number().positive("Informe o valor da venda"),
  downPayment: z.coerce.number().nonnegative().default(0),
  receivedValue: z.coerce.number().nonnegative().default(0),
  paymentMethod: z.string().default("Pix"),
  installments: z.coerce.number().int().min(1).default(1),
  paymentStatus: z.string().default("Pendente"),
  soldAt: z.string().optional().nullable(),
  startAt: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  return withUser(async (user) => {
    const where: any = { deletedAt: null };
    if (user.role !== "ADMIN") where.userId = user.id;
    const sales = await prisma.sale.findMany({
      where,
      orderBy: { soldAt: "desc" },
      take: 300,
      include: {
        lead: { select: { id: true, name: true, company: true } },
        user: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(sales);
  });
}

export async function POST(req: NextRequest) {
  return withUser(async (user) => {
    const data = schema.parse(await req.json());
    const lead = await prisma.lead.findFirst({ where: { id: data.leadId, deletedAt: null } });
    if (!lead) return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    if (user.role !== "ADMIN" && lead.ownerId !== user.id)
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    const received =
      data.receivedValue || (data.paymentStatus === "Pago" ? data.totalValue :
      data.paymentStatus === "Entrada paga" ? data.downPayment : 0);

    const sale = await prisma.sale.create({
      data: {
        leadId: data.leadId, userId: user.role === "ADMIN" ? lead.ownerId : user.id,
        service: data.service, totalValue: data.totalValue, downPayment: data.downPayment,
        receivedValue: received, paymentMethod: data.paymentMethod, installments: data.installments,
        paymentStatus: data.paymentStatus,
        soldAt: data.soldAt ? new Date(data.soldAt) : new Date(),
        startAt: data.startAt ? new Date(data.startAt) : null,
        note: data.note ?? null,
      },
    });

    if (lead.stage !== "Venda fechada") {
      await prisma.$transaction([
        prisma.lead.update({ where: { id: lead.id }, data: { stage: "Venda fechada" } }),
        prisma.leadStageHistory.create({
          data: { leadId: lead.id, fromStage: lead.stage, toStage: "Venda fechada", userId: user.id },
        }),
      ]);
    }
    await audit(user.id, "create", "Sale", sale.id, `Venda fechada: ${lead.name} · R$ ${data.totalValue}`);

    // notifica o administrador
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", deletedAt: null } });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "Venda fechada 🎉",
        body: `${lead.name} — R$ ${data.totalValue.toLocaleString("pt-BR")} (${data.service})`,
      })),
    });
    return NextResponse.json(sale, { status: 201 });
  });
}
