import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const hasOwn = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);
const normalizeInvoiceStatus = (status: unknown) => {
  const value = String(status ?? "รอชำระ").trim();
  const statusMap: Record<string, string> = {
    PENDING: "รอชำระ",
    PAID: "ชำระแล้ว",
    CANCELLED: "ยกเลิก",
    "รอชำระ": "รอชำระ",
    "ชำระแล้ว": "ชำระแล้ว",
    "ยกเลิก": "ยกเลิก",
  };

  return statusMap[value] ?? "รอชำระ";
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);
    const body = await request.json() as Record<string, unknown>;

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    const updateData: {
      invoiceNumber?: string;
      customerId?: number;
      salespersonId?: number;
      total?: number;
      commissionRate?: number;
      commissionTons?: number;
      status?: string;
      dueDate?: Date | null;
      paidAt?: Date | null;
      itemName?: string | null;
      quantity?: number | null;
      unit?: string | null;
      unitPrice?: number | null;
      note?: string | null;
      saleDate?: Date | null;
      paymentDates?: Date[];
      paymentAmounts?: number[];
      needsReview?: boolean;
      reviewNotes?: string | null;
    } = {};

    if (hasOwn(body, "invoiceNumber")) {
      const invoiceNumber = String(body.invoiceNumber ?? "").trim();

      if (!invoiceNumber) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.invoiceNumber = invoiceNumber;
    }

    if (hasOwn(body, "customerId")) {
      const customerId = Number(body.customerId);

      if (!Number.isInteger(customerId)) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.customerId = customerId;
    }

    if (hasOwn(body, "salespersonId")) {
      const salespersonId = Number(body.salespersonId);

      if (!Number.isInteger(salespersonId)) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.salespersonId = salespersonId;
    }

    if (hasOwn(body, "total")) {
      const total = Number(body.total);

      if (!Number.isFinite(total) || total <= 0) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.total = total;
    }

    if (hasOwn(body, "commissionRate")) {
      const commissionRate = Number(body.commissionRate);

      if (!Number.isFinite(commissionRate) || commissionRate < 0) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.commissionRate = commissionRate;
    }

    if (hasOwn(body, "commissionTons")) {
      const commissionTons = Number(body.commissionTons);

      if (!Number.isFinite(commissionTons) || commissionTons < 0) {
        return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      }

      updateData.commissionTons = commissionTons;
    }

    if (hasOwn(body, "status")) {
      updateData.status = normalizeInvoiceStatus(body.status);
    }

    if (hasOwn(body, "dueDate")) {
      const dueDate = String(body.dueDate ?? "").trim();
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (hasOwn(body, "paidAt")) {
      const paidAt = String(body.paidAt ?? "").trim();
      updateData.paidAt = paidAt ? new Date(paidAt) : null;
    }

    if (hasOwn(body, "itemName")) {
      const v = String(body.itemName ?? "").trim();
      updateData.itemName = v || null;
    }
    if (hasOwn(body, "unit")) {
      const v = String(body.unit ?? "").trim();
      updateData.unit = v || null;
    }
    if (hasOwn(body, "note")) {
      const v = String(body.note ?? "").trim();
      updateData.note = v || null;
    }
    if (hasOwn(body, "quantity")) {
      const raw = body.quantity;
      if (raw === null || raw === "" || raw === undefined) {
        updateData.quantity = null;
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
        }
        updateData.quantity = n;
      }
    }
    if (hasOwn(body, "unitPrice")) {
      const raw = body.unitPrice;
      if (raw === null || raw === "" || raw === undefined) {
        updateData.unitPrice = null;
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) {
          return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
        }
        updateData.unitPrice = n;
      }
    }
    if (hasOwn(body, "saleDate")) {
      const v = String(body.saleDate ?? "").trim();
      updateData.saleDate = v ? new Date(v) : null;
    }
    if (hasOwn(body, "paymentDates")) {
      const arr = Array.isArray(body.paymentDates) ? body.paymentDates : [];
      updateData.paymentDates = arr
        .map((entry) => {
          const t = String(entry ?? "").trim();
          if (!t) return null;
          const d = new Date(t);
          return Number.isNaN(d.getTime()) ? null : d;
        })
        .filter((d): d is Date => d !== null);
    }
    if (hasOwn(body, "paymentAmounts")) {
      const arr = Array.isArray(body.paymentAmounts) ? body.paymentAmounts : [];
      updateData.paymentAmounts = arr.map((entry) => {
        const n = Number(entry);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      });
    }
    if (hasOwn(body, "needsReview")) {
      updateData.needsReview = Boolean(body.needsReview);
    }
    if (hasOwn(body, "reviewNotes")) {
      const v = String(body.reviewNotes ?? "").trim();
      updateData.reviewNotes = v || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        salesperson: true,
        commission: true,
      },
    });

    if (
      hasOwn(body, "total") ||
      hasOwn(body, "commissionRate") ||
      hasOwn(body, "commissionTons") ||
      hasOwn(body, "salespersonId")
    ) {
      await prisma.commission.upsert({
        where: { invoiceId: id },
        update: {
          salespersonId: invoice.salespersonId,
          amount: invoice.commissionTons * invoice.commissionRate,
        },
        create: {
          invoiceId: id,
          salespersonId: invoice.salespersonId,
          amount: invoice.commissionTons * invoice.commissionRate,
        },
      });
    }

    const updatedInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        salesperson: true,
        commission: true,
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    await prisma.invoice.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
