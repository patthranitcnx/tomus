import { prisma } from "@/lib/prisma";
import { canUseLocalRecords, deleteLocalSaleRecord } from "@/lib/local-records";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid sale record id" }, { status: 400 });
    }

    await prisma.saleRecord.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (canUseLocalRecords()) {
      const deleted = await deleteLocalSaleRecord(Number(params.id));

      return NextResponse.json({ ok: deleted });
    }

    return NextResponse.json({ error: "Failed to delete sale record" }, { status: 500 });
  }
}
