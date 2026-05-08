import { prisma } from "@/lib/prisma";
import { canUseLocalPurchases, deleteLocalPurchase } from "@/lib/local-purchases";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid purchase id" }, { status: 400 });
    }

    await prisma.purchase.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (canUseLocalPurchases()) {
      const deleted = await deleteLocalPurchase(Number(params.id));

      return NextResponse.json({ ok: deleted });
    }

    return NextResponse.json({ error: "Failed to delete purchase" }, { status: 500 });
  }
}
