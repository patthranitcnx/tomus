import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid salesperson id" }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: "Salesperson name is required" }, { status: 400 });
    }

    const salesperson = await prisma.salesperson.update({
      where: { id },
      data: {
        name,
        email: String(body.email ?? "").trim() || null,
        phone: String(body.phone ?? "").trim() || null,
      },
      include: {
        invoices: true,
        commissions: true,
      },
    });

    return NextResponse.json(salesperson);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update salesperson" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid salesperson id" }, { status: 400 });
    }

    await prisma.salesperson.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete salesperson" }, { status: 500 });
  }
}
