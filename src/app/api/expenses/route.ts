import { prisma } from "@/lib/prisma";
import {
  canUseLocalRecords,
  createLocalExpense,
  readLocalExpenses,
} from "@/lib/local-records";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { expenseDate: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    if (canUseLocalRecords()) {
      const expenses = await readLocalExpenses();
      return NextResponse.json(expenses);
    }

    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  const amount = Number(body.amount);
  const expenseDate = String(body.expenseDate ?? "").trim();

  if (!title || !category || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid expense data" }, { status: 400 });
  }

  const expenseData = {
    title,
    category,
    amount,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    note: String(body.note ?? "").trim() || null,
  };

  try {
    const expense = await prisma.expense.create({
      data: expenseData,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (canUseLocalRecords()) {
      const expense = await createLocalExpense({
        ...expenseData,
        expenseDate: expenseData.expenseDate.toISOString(),
      });

      return NextResponse.json(expense, { status: 201 });
    }

    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
