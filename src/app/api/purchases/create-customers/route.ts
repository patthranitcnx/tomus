import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    // Get all unique suppliers from purchases
    const purchases = await prisma.purchase.findMany({
      where: {
        supplier: {
          not: null,
        },
      },
      distinct: ["supplier"],
      select: {
        supplier: true,
        address: true,
      },
    });

    if (purchases.length === 0) {
      return NextResponse.json(
        { error: "ไม่มีข้อมูลผู้ขายที่จะสร้างเป็นคู่ค้า" },
        { status: 400 }
      );
    }

    // Get existing customers to avoid duplicates
    const existingCustomers = await prisma.customer.findMany({
      select: { name: true },
    });

    const existingNames = new Set(existingCustomers.map((c) => c.name.toLowerCase()));

    // Filter out suppliers that already exist as customers
    const newCustomers = purchases.filter(
      (purchase) =>
        purchase.supplier &&
        !existingNames.has(purchase.supplier.toLowerCase())
    );

    if (newCustomers.length === 0) {
      return NextResponse.json(
        { error: "ผู้ขายทั้งหมดมีอยู่แล้วในระบบ" },
        { status: 400 }
      );
    }

    // Create customers from unique suppliers
    const createdCustomers = await prisma.customer.createMany({
      data: newCustomers.map((purchase) => ({
        name: purchase.supplier!,
        address: purchase.address || null,
        phone: null,
        email: null,
      })),
    });

    return NextResponse.json({
      count: createdCustomers.count,
      message: `สร้างคู่ค้าใหม่ ${createdCustomers.count} รายจากผู้ขาย`,
    });
  } catch (error) {
    console.error("Error creating customers from purchases:", error);
    return NextResponse.json(
      { error: "ไม่สามารถสร้างคู่ค้าได้" },
      { status: 500 }
    );
  }
}
