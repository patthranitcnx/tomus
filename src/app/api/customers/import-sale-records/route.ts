import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type CustomerContact = {
  name: string;
  phone: string | null;
  address: string | null;
};

export async function POST() {
  try {
    const saleRecords = await prisma.saleRecord.findMany({
      where: {
        customer: {
          not: null,
        },
      },
      orderBy: {
        saleDate: "desc",
      },
      select: {
        customer: true,
        customerPhone: true,
        customerAddress: true,
      },
    });

    const contacts = new Map<string, CustomerContact>();

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
      return NextResponse.json({ error: "ไม่มีรายชื่อลูกค้าจากรายการขาย" }, { status: 400 });
    }

    const existingCustomers = await prisma.customer.findMany();
    const existingByName = new Map(existingCustomers.map((customer) => [customer.name.trim().toLowerCase(), customer]));
    let created = 0;
    let updated = 0;

    for (const contact of contacts.values()) {
      const existing = existingByName.get(contact.name.toLowerCase());

      if (!existing) {
        await prisma.customer.create({
          data: {
            name: contact.name,
            phone: contact.phone,
            address: contact.address,
          },
        });
        created += 1;
        continue;
      }

      const nextPhone = existing.phone || contact.phone;
      const nextAddress = existing.address || contact.address;

      if (nextPhone !== existing.phone || nextAddress !== existing.address) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            phone: nextPhone,
            address: nextAddress,
          },
        });
        updated += 1;
      }
    }

    return NextResponse.json({
      created,
      updated,
      count: created + updated,
      message: `นำเข้าลูกค้าใหม่ ${created} ราย และอัปเดตข้อมูลติดต่อ ${updated} ราย`,
    });
  } catch (error) {
    return NextResponse.json({ error: "ไม่สามารถนำเข้าลูกค้าจากรายการขายได้" }, { status: 500 });
  }
}
