import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          include: {
            salesperson: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const nameKey = customer.name.trim().toLowerCase();
    const phoneKey = (customer.phone ?? "").trim();

    const candidates = await prisma.saleRecord.findMany({
      orderBy: { saleDate: "desc" },
    });

    const saleRecords = candidates.filter((record) => {
      const recordName = (record.customer ?? "").trim().toLowerCase();
      const recordPhone = (record.customerPhone ?? "").trim();

      if (nameKey && recordName === nameKey) {
        return true;
      }

      if (phoneKey && recordPhone && recordPhone === phoneKey) {
        return true;
      }

      return false;
    });

    return NextResponse.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      },
      invoices: customer.invoices,
      saleRecords,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch customer purchases" }, { status: 500 });
  }
}
