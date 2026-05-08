import { prisma } from "@/lib/prisma";
import { canUseLocalPurchases, deleteLocalPurchase, updateLocalPurchase } from "@/lib/local-purchases";
import { NextResponse } from "next/server";

function parsePurchaseBody(body: Record<string, unknown>) {
  const itemName = String(body.itemName ?? "").trim();
  const quantity = Number(body.quantity);
  const unitPrice = Number(body.unitPrice);
  const purchaseDate = String(body.purchaseDate ?? "").trim();

  if (!itemName || !Number.isFinite(quantity) || !Number.isFinite(unitPrice) || quantity <= 0 || unitPrice < 0) {
    return null;
  }

  return {
    itemName,
    supplier: String(body.supplier ?? "").trim() || null,
    address: String(body.address ?? "").trim() || null,
    quantity,
    unit: String(body.unit ?? "").trim() || null,
    unitPrice,
    total: quantity * unitPrice,
    purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
    note: String(body.note ?? "").trim() || null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid purchase id" }, { status: 400 });
  }

  const body = await request.json();
  const purchaseData = parsePurchaseBody(body);

  if (!purchaseData) {
    return NextResponse.json({ error: "Invalid purchase data" }, { status: 400 });
  }

  try {
    const purchase = await prisma.purchase.update({
      where: { id },
      data: purchaseData,
    });

    return NextResponse.json(purchase);
  } catch (error) {
    if (canUseLocalPurchases()) {
      const purchase = await updateLocalPurchase(id, {
        ...purchaseData,
        purchaseDate: purchaseData.purchaseDate.toISOString(),
      });

      if (purchase) {
        return NextResponse.json(purchase);
      }
    }

    return NextResponse.json({ error: "Failed to update purchase" }, { status: 500 });
  }
}

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
