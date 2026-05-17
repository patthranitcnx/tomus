import { prisma } from "@/lib/prisma";
import { compareInvoiceNumbers } from "@/lib/invoice-sorting";
import { sanitizeItems, computeItemsTotal } from "@/lib/invoice-items";
import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true, address: true } },
        salesperson: { select: { id: true, name: true } },
        commission: true,
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
    });
    invoices.sort((a, b) => compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber) || a.id - b.id);

    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

const parseDateList = (value: unknown): Date[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const trimmed = String(entry ?? "").trim();
      if (!trimmed) return null;
      const date = new Date(trimmed);
      return Number.isNaN(date.getTime()) ? null : date;
    })
    .filter((d): d is Date => d !== null);
};

const parseAmountList = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => Number(entry))
    .map((num) => (Number.isFinite(num) && num >= 0 ? num : 0));
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const customerId = Number(body.customerId);
    const salespersonId = Number(body.salespersonId);
    const commissionRate = Number(body.commissionRate);
    const commissionTons = Number(body.commissionTons);
    const status = normalizeInvoiceStatus(body.status);
    const dueDate = String(body.dueDate ?? "").trim();

    const items = sanitizeItems(body.items);
    const computedTotal = computeItemsTotal(items);
    const bodyTotal = Number(body.total);
    const total = items.length > 0 ? computedTotal : (Number.isFinite(bodyTotal) ? bodyTotal : 0);

    const note = body.note != null ? String(body.note).trim() || null : null;
    const saleDateRaw = body.saleDate != null ? String(body.saleDate).trim() : "";
    const saleDate = saleDateRaw ? new Date(saleDateRaw) : null;
    const paymentDates = parseDateList(body.paymentDates);
    const paymentAmounts = parseAmountList(body.paymentAmounts);
    const needsReview = Boolean(body.needsReview);
    const reviewNotes = body.reviewNotes != null ? String(body.reviewNotes).trim() || null : null;

    if (
      !invoiceNumber ||
      !Number.isInteger(customerId) ||
      !Number.isInteger(salespersonId) ||
      !Number.isFinite(commissionRate) ||
      !Number.isFinite(commissionTons) ||
      total <= 0 ||
      commissionTons < 0 ||
      commissionRate < 0
    ) {
      return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customer: { connect: { id: customerId } },
        salesperson: { connect: { id: salespersonId } },
        total,
        commissionRate,
        commissionTons,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        note,
        saleDate,
        paymentDates,
        paymentAmounts,
        needsReview,
        reviewNotes,
        items: items.length > 0 ? { create: items } : undefined,
        commission: {
          create: {
            salesperson: { connect: { id: salespersonId } },
            amount: commissionTons * commissionRate,
          },
        },
      },
      include: {
        customer: true,
        salesperson: true,
        commission: true,
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
