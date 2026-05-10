import { prisma } from "@/lib/prisma";
import {
  canUseLocalRecords,
  createLocalSaleRecord,
  readLocalSaleRecords,
} from "@/lib/local-records";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const saleRecords = await prisma.saleRecord.findMany({
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json(saleRecords);
  } catch (error) {
    if (canUseLocalRecords()) {
      const saleRecords = await readLocalSaleRecords();
      return NextResponse.json(saleRecords);
    }

    return NextResponse.json({ error: "Failed to fetch sale records" }, { status: 500 });
  }
}

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
    customerPhone: String(body.customerPhone ?? "").trim() || null,
    customerAddress: String(body.customerAddress ?? "").trim() || null,
    quantity,
    unit: String(body.unit ?? "").trim() || null,
    unitPrice,
    total: quantity * unitPrice,
    saleDate: saleDate ? new Date(saleDate) : new Date(),
    note: String(body.note ?? "").trim() || null,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const items = Array.isArray(body.items) ? body.items : [body];
  const saleRecordsData = items.map((item) =>
    parseSaleRecordBody({
      ...(item as Record<string, unknown>),
      customer: body.customer,
      customerPhone: body.customerPhone,
      customerAddress: body.customerAddress,
      saleDate: body.saleDate,
      note: body.note,
    }),
  );

  if (saleRecordsData.length === 0 || saleRecordsData.some((record) => record === null)) {
    return NextResponse.json({ error: "Invalid sale record data" }, { status: 400 });
  }

  const validSaleRecordsData = saleRecordsData.filter((record) => record !== null);

  try {
    const saleRecords = await prisma.saleRecord.createMany({
      data: validSaleRecordsData,
    });

    return NextResponse.json(saleRecords, { status: 201 });
  } catch (error) {
    if (canUseLocalRecords()) {
      const saleRecords = [];

      for (const saleRecordData of validSaleRecordsData) {
        const saleRecord = await createLocalSaleRecord({
          ...saleRecordData,
          saleDate: saleRecordData.saleDate.toISOString(),
        });

        saleRecords.push(saleRecord);
      }

      return NextResponse.json({ count: saleRecords.length, saleRecords }, { status: 201 });
    }

    return NextResponse.json({ error: "Failed to create sale record" }, { status: 500 });
  }
}
