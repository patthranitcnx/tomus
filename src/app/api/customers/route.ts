import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function syncCustomersFromSaleRecords() {
  const saleRecords = await prisma.saleRecord.findMany({
    where: { customer: { not: null } },
    select: { customer: true, customerPhone: true, customerAddress: true },
  });

  if (saleRecords.length === 0) {
    return;
  }

  const contacts = new Map<string, { name: string; phone: string | null; address: string | null }>();

  for (const record of saleRecords) {
    const name = record.customer?.trim();

    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    const current = contacts.get(key);

    if (current) {
      current.phone ||= record.customerPhone?.trim() || null;
      current.address ||= record.customerAddress?.trim() || null;
    } else {
      contacts.set(key, {
        name,
        phone: record.customerPhone?.trim() || null,
        address: record.customerAddress?.trim() || null,
      });
    }
  }

  if (contacts.size === 0) {
    return;
  }

  const existingCustomers = await prisma.customer.findMany({
    select: { id: true, name: true, phone: true, address: true },
  });
  const existingByName = new Map(existingCustomers.map((customer) => [customer.name.trim().toLowerCase(), customer]));

  for (const contact of contacts.values()) {
    const existing = existingByName.get(contact.name.toLowerCase());

    if (!existing) {
      await prisma.customer.create({
        data: { name: contact.name, phone: contact.phone, address: contact.address },
      });
      continue;
    }

    const nextPhone = existing.phone || contact.phone;
    const nextAddress = existing.address || contact.address;

    if (nextPhone !== existing.phone || nextAddress !== existing.address) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { phone: nextPhone, address: nextAddress },
      });
    }
  }
}

export async function GET() {
  try {
    await syncCustomersFromSaleRecords();

    const customers = await prisma.customer.findMany({
      include: {
        invoices: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone: String(body.phone ?? "").trim() || null,
        email: String(body.email ?? "").trim() || null,
        address: String(body.address ?? "").trim() || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}
