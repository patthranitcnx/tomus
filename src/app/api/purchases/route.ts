import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type PurchaseItemPayload = {
  itemName?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
};

export async function GET() {
  try {
    const purchases = await prisma.purchase.findMany({
      orderBy: { purchaseDate: "desc" },
    });

    return NextResponse.json(purchases);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const purchaseDate = String(body.purchaseDate ?? "").trim();
    const supplier = String(body.supplier ?? "").trim() || null;
    const note = String(body.note ?? "").trim() || null;
    const items: PurchaseItemPayload[] = Array.isArray(body.items)
      ? body.items
      : [
          {
            itemName: body.itemName,
            quantity: body.quantity,
            unit: body.unit,
            unitPrice: body.unitPrice,
          },
        ];

    const purchaseItems = items
      .map((item) => {
        const itemName = String(item.itemName ?? "").trim();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        return {
          itemName,
          supplier,
          quantity,
          unit: String(item.unit ?? "").trim() || null,
          unitPrice,
          total: quantity * unitPrice,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          note,
        };
      })
      .filter(
        (item) =>
          item.itemName &&
          Number.isFinite(item.quantity) &&
          Number.isFinite(item.unitPrice) &&
          item.quantity > 0 &&
          item.unitPrice >= 0,
      );

    if (purchaseItems.length === 0 || purchaseItems.length !== items.length) {
      return NextResponse.json({ error: "Invalid purchase data" }, { status: 400 });
    }

    await prisma.purchase.createMany({
      data: purchaseItems,
    });

    return NextResponse.json({ count: purchaseItems.length }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
  }
}
