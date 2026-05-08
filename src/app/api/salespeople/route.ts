import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const salespeople = await prisma.salesperson.findMany({
      include: {
        invoices: true,
        commissions: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(salespeople);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch salespeople" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();

    if (!name) {
      return NextResponse.json({ error: "Salesperson name is required" }, { status: 400 });
    }

    const salesperson = await prisma.salesperson.create({
      data: {
        name,
        email: String(body.email ?? "").trim() || null,
        phone: String(body.phone ?? "").trim() || null,
      },
    });

    return NextResponse.json(salesperson, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create salesperson" }, { status: 500 });
  }
}
