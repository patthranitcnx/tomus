import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const hasOwn = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

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
      status?: string;
      dueDate?: Date | null;
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

    if (hasOwn(body, "status")) {
      updateData.status = String(body.status ?? "PENDING");
    }

    if (hasOwn(body, "dueDate")) {
      const dueDate = String(body.dueDate ?? "").trim();
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
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
      hasOwn(body, "salespersonId")
    ) {
      await prisma.commission.upsert({
        where: { invoiceId: id },
        update: {
          salespersonId: invoice.salespersonId,
          amount: invoice.total * (invoice.commissionRate / 100),
        },
        create: {
          invoiceId: id,
          salespersonId: invoice.salespersonId,
          amount: invoice.total * (invoice.commissionRate / 100),
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
