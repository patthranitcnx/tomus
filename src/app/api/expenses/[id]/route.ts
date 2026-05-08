import { prisma } from "@/lib/prisma";
import { canUseLocalRecords, deleteLocalExpense } from "@/lib/local-records";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (canUseLocalRecords()) {
      const deleted = await deleteLocalExpense(Number(params.id));

      return NextResponse.json({ ok: deleted });
    }

    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
