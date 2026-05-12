import { prisma } from "@/lib/prisma";
import {
  canUseLocalPurchases,
  createLocalPurchases,
  readLocalPurchases,
} from "@/lib/local-purchases";
import { NextResponse } from "next/server";

type PurchaseItemPayload = {
  itemName?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
};

function parsePaymentDates(body: Record<string, unknown>) {
  const rawDates = Array.isArray(body.paymentDates) ? body.paymentDates : [body.paymentDate];

  return rawDates
    .map((date) => String(date ?? "").trim())
    .filter(Boolean)
    .map((date) => new Date(date))
    .filter((date) => !Number.isNaN(date.getTime()));
}

function getItemsFromBody(body: Record<string, unknown>) {
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

  return items;
}

export async function GET() {
  try {
    const purchases = await prisma.purchase.findMany({
      orderBy: [{ purchaseDate: "desc" }, { id: "desc" }],
    });

    return NextResponse.json(purchases);
  } catch (error) {
    if (canUseLocalPurchases()) {
      const purchases = await readLocalPurchases();
      return NextResponse.json(purchases);
    }

    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const purchaseDate = String(body.purchaseDate ?? "").trim();
  const supplier = String(body.supplier ?? "").trim() || null;
  const address = String(body.address ?? "").trim() || null;
  const note = String(body.note ?? "").trim() || null;
  const items = getItemsFromBody(body);

  const purchaseDateValue = purchaseDate ? new Date(purchaseDate) : new Date();
  const paymentDates = parsePaymentDates(body);
  const purchaseItems = items
    .map((item) => {
      const itemName = String(item.itemName ?? "").trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      return {
        itemName,
        supplier,
        address,
        quantity,
        unit: String(item.unit ?? "").trim() || null,
        unitPrice,
        total: quantity * unitPrice,
        purchaseDate: purchaseDateValue,
        paymentDates,
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

  try {
    await prisma.purchase.createMany({
      data: purchaseItems,
    });

    return NextResponse.json({ count: purchaseItems.length }, { status: 201 });
  } catch (error) {
    if (canUseLocalPurchases()) {
      await createLocalPurchases(
        purchaseItems.map((item) => ({
          ...item,
          purchaseDate: item.purchaseDate.toISOString(),
          paymentDates: item.paymentDates.map((date) => date.toISOString()),
        })),
      );

      return NextResponse.json({ count: purchaseItems.length }, { status: 201 });
    }

    return NextResponse.json({ error: "Failed to create purchase" }, { status: 500 });
  }
}
