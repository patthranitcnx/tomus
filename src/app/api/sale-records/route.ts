import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const saleRecords = await prisma.saleRecord.findMany({
      orderBy: { saleDate: "desc" },
    });

    return NextResponse.json(saleRecords);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sale records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const itemName = String(body.itemName ?? "").trim();
    const quantity = Number(body.quantity);
    const unitPrice = Number(body.unitPrice);
    const saleDate = String(body.saleDate ?? "").trim();

    if (!itemName || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
      return NextResponse.json({ error: "Invalid sale record data" }, { status: 400 });
    }

    const saleRecord = await prisma.saleRecord.create({
      data: {
        itemName,
        customer: String(body.customer ?? "").trim() || null,
        quantity,
        unit: String(body.unit ?? "").trim() || null,
        unitPrice,
        total: quantity * unitPrice,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        note: String(body.note ?? "").trim() || null,
      },
    });

    return NextResponse.json(saleRecord, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create sale record" }, { status: 500 });
  }
}
