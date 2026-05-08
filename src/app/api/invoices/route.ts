import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        customer: true,
        salesperson: true,
        commission: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const customerId = Number(body.customerId);
    const salespersonId = Number(body.salespersonId);
    const total = Number(body.total);
    const commissionRate = Number(body.commissionRate);
    const status = String(body.status ?? "PENDING");
    const dueDate = String(body.dueDate ?? "").trim();

    if (
      !invoiceNumber ||
      !Number.isInteger(customerId) ||
      !Number.isInteger(salespersonId) ||
      !Number.isFinite(total) ||
      !Number.isFinite(commissionRate) ||
      total <= 0 ||
      commissionRate < 0
    ) {
      return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customer: {
          connect: { id: customerId },
        },
        salesperson: {
          connect: { id: salespersonId },
        },
        total,
        commissionRate,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        commission: {
          create: {
            salesperson: {
              connect: { id: salespersonId },
            },
            amount: total * (commissionRate / 100),
          },
        },
      },
      include: {
        customer: true,
        salesperson: true,
        commission: true,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
