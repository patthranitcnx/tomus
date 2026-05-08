import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const paid = Boolean(body.paid);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid commission id" }, { status: 400 });
    }

    const commission = await prisma.commission.update({
      where: { id },
      data: {
        paid,
        paidAt: paid ? new Date() : null,
      },
      include: {
        invoice: true,
        salesperson: true,
      },
    });

    return NextResponse.json(commission);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update commission" }, { status: 500 });
  }
}
