import { prisma } from "@/lib/prisma";
import { canUseLocalRecords, deleteLocalExpense, updateLocalExpense } from "@/lib/local-records";
import { NextResponse } from "next/server";

function parseExpenseBody(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const category = String(body.category ?? "").trim();
  const amount = Number(body.amount);
  const expenseDate = String(body.expenseDate ?? "").trim();

  if (!title || !category || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    title,
    category,
    amount,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    note: String(body.note ?? "").trim() || null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);

  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
  }

  const body = await request.json();
  const expenseData = parseExpenseBody(body);

  if (!expenseData) {
    return NextResponse.json({ error: "Invalid expense data" }, { status: 400 });
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: expenseData,
    });

    return NextResponse.json(expense);
  } catch (error) {
    if (canUseLocalRecords()) {
      const expense = await updateLocalExpense(id, {
        ...expenseData,
        expenseDate: expenseData.expenseDate.toISOString(),
      });

      if (expense) {
        return NextResponse.json(expense);
      }
    }

    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const id = Number(params.id);

    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Invalid expense id" }, { status: 400 });
    }

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (canUseLocalRecords()) {
      const deleted = await deleteLocalExpense(Number(params.id));

      return NextResponse.json({ ok: deleted });
    }

    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}
