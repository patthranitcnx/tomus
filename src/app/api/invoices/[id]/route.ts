import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { sanitizeItems, computeItemsTotal } from "@/lib/invoice-items";

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
      note?: string | null;
      saleDate?: Date | null;
      paymentDates?: Date[];
      paymentAmounts?: number[];
      needsReview?: boolean;
      reviewNotes?: string | null;
    } = {};

    if (hasOwn(body, "invoiceNumber")) {
      const invoiceNumber = String(body.invoiceNumber ?? "").trim();
      if (!invoiceNumber) return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      updateData.invoiceNumber = invoiceNumber;
    }

    if (hasOwn(body, "customerId")) {
      const customerId = Number(body.customerId);
      if (!Number.isInteger(customerId)) return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      updateData.customerId = customerId;
    }

    if (hasOwn(body, "salespersonId")) {
      const salespersonId = Number(body.salespersonId);
      if (!Number.isInteger(salespersonId)) return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
      updateData.salespersonId = salespersonId;
    }

    // If items provided, compute total from items (overrides body.total)
    const itemsProvided = hasOwn(body, "items");
    const sanitizedItems = itemsProvided ? sanitizeItems(body.items) : [];

    if (itemsProvided) {
      updateData.total = computeItemsTotal(sanitizedItems);
    } else if (hasOwn(body, "total")) {
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

    if (hasOwn(body, "note")) {
      const v = String(body.note ?? "").trim();
      updateData.note = v || null;
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

    if (Object.keys(updateData).length === 0 && !itemsProvided) {
      return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
    }

    // Update invoice + replace items in a transaction
    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.invoice.update({ where: { id }, data: updateData });
      }
      if (itemsProvided) {
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        if (sanitizedItems.length > 0) {
          await tx.invoiceItem.createMany({
            data: sanitizedItems.map((item) => ({ ...item, invoiceId: id })),
          });
        }
      }
    });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        salesperson: true,
        commission: true,
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (
      hasOwn(body, "total") ||
      itemsProvided ||
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
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
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
