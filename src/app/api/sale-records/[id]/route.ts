import { prisma } from "@/lib/prisma";
import { canUseLocalRecords, deleteLocalSaleRecord, updateLocalSaleRecord } from "@/lib/local-records";
import { NextResponse } from "next/server";

function parseSaleRecordBody(body: Record<string, unknown>) {
  const itemName = String(body.itemName ?? "").trim();
  const quantity = Number(body.quantity);
  const unitPrice = Number(body.unitPrice);
  const saleDate = String(body.saleDate ?? "").trim();

  if (!itemName || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
    return null;
  }

  return {
    itemName,
    customer: String(body.customer ?? "").trim() || null,
    quantity,
    unit: String(body.unit ?? "").trim() || null,
    unitPrice,
    total: quantity * unitPrice,
    saleDate: saleDate ? new Date(saleDate) : new Date(),
    note: String(body.note ?? "").trim() || null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid sale record id" }, { status: 400 });
  }

  const body = await request.json();
  const saleRecordData = parseSaleRecordBody(body);

  if (!saleRecordData) {
    return NextResponse.json({ error: "Invalid sale record data" }, { status: 400 });
  }

  try {
    const saleRecord = await prisma.saleRecord.update({
      where: { id },
      data: saleRecordData,
    });

    return NextResponse.json(saleRecord);
  } catch (error) {
    if (canUseLocalRecords()) {
      const saleRecord = await updateLocalSaleRecord(id, {
        ...saleRecordData,
        saleDate: saleRecordData.saleDate.toISOString(),
      });

      if (saleRecord) {
        return NextResponse.json(saleRecord);
      }
    }

    return NextResponse.json({ error: "Failed to update sale record" }, { status: 500 });
  }
}

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
