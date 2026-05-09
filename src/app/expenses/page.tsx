"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  note: string | null;
};

type ExpenseEditForm = {
  title: string;
  category: string;
  amount: string;
  expenseDate: string;
  note: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const categories = ["ค่าขนส่ง", "ค่าแรง", "ค่าน้ำมัน", "ค่าเช่า", "สำนักงาน", "อื่น ๆ"];
const toDateInputValue = (date: string) => new Date(date).toISOString().slice(0, 10);

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ExpenseEditForm | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [form, setForm] = useState({
    title: "",
    category: "ค่าขนส่ง",
    amount: "",
    expenseDate: "",
    note: "",
  });

  const total = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const monthlyExpenses = useMemo(() => {
    const grouped = expenses.reduce<Record<string, { label: string; total: number; count: number }>>((summary, expense) => {
      const date = new Date(expense.expenseDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      if (!summary[key]) {
        summary[key] = {
          label: date.toLocaleDateString("th-TH", { month: "long", year: "numeric" }),
          total: 0,
          count: 0,
        };
      }

      summary[key].total += expense.amount;
      summary[key].count += 1;

      return summary;
    }, {});

    return Object.entries(grouped)
      .map(([month, summary]) => ({ month, ...summary }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [expenses]);
  const selectedMonthSummary = monthlyExpenses.find((month) => month.month === selectedMonth);
  const filteredExpenses = useMemo(() => {
    if (selectedMonth === "all") {
      return expenses;
    }

    return expenses.filter((expense) => {
      const date = new Date(expense.expenseDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      return month === selectedMonth;
    });
  }, [expenses, selectedMonth]);
  const visibleTotal = selectedMonthSummary?.total ?? total;

  const fetchExpenses = async () => {
    const response = await fetch("/api/expenses");
    const data = await response.json();
    setExpenses(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
      }),
    });

    if (response.ok) {
      setForm({ title: "", category: "ค่าขนส่ง", amount: "", expenseDate: "", note: "" });
      await fetchExpenses();
    }

    setSaving(false);
  };

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditForm({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      expenseDate: toDateInputValue(expense.expenseDate),
      note: expense.note || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<ExpenseEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        amount: Number(editForm.amount),
      }),
    });

    if (response.ok) {
      cancelEdit();
      await fetchExpenses();
    }

    setUpdating(false);
  };

  const deleteExpense = async (id: number) => {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await fetchExpenses();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ค่าใช้จ่าย</p>
          <h1>บันทึกค่าใช้จ่าย</h1>
        </div>
        <article className="mini-total">
          <span>{selectedMonthSummary ? `ค่าใช้จ่าย${selectedMonthSummary.label}` : "ค่าใช้จ่ายรวม"}</span>
          <strong>{money.format(visibleTotal)}</strong>
        </article>
      </header>

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>เพิ่มค่าใช้จ่าย</h2>
          <input required placeholder="รายการ เช่น ค่าขนส่งสินค้า" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <input required min="0" step="0.001" type="number" placeholder="จำนวนเงิน" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          <input type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
          <textarea placeholder="หมายเหตุ" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}</button>
        </form>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">
                {selectedMonthSummary ? `${selectedMonthSummary.count} รายการในเดือนนี้` : `ทั้งหมด ${expenses.length} รายการ`}
              </p>
              <h2>{selectedMonthSummary ? `ค่าใช้จ่าย${selectedMonthSummary.label}` : "ประวัติค่าใช้จ่าย"}</h2>
            </div>
          </div>

          <div className="month-filter" aria-label="เลือกเดือนค่าใช้จ่าย">
            <button className={selectedMonth === "all" ? "active" : ""} type="button" onClick={() => setSelectedMonth("all")}>
              ทุกเดือน
              <span>{money.format(total)}</span>
            </button>
            {monthlyExpenses.map((month) => (
              <button
                className={selectedMonth === month.month ? "active" : ""}
                key={month.month}
                type="button"
                onClick={() => setSelectedMonth(month.month)}
              >
                {month.label}
                <span>{money.format(month.total)}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="muted">ยังไม่มีค่าใช้จ่ายในเดือนนี้</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>รายการ</th>
                    <th>หมวดหมู่</th>
                    <th>จำนวนเงิน</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id}>
                      {editingId === expense.id && editForm ? (
                        <>
                          <td>
                            <input
                              className="table-input"
                              type="date"
                              value={editForm.expenseDate}
                              onChange={(event) => updateEditForm({ expenseDate: event.target.value })}
                            />
                          </td>
                          <td>
                            <div className="table-field-stack">
                              <input
                                className="table-input"
                                required
                                placeholder="รายการ"
                                value={editForm.title}
                                onChange={(event) => updateEditForm({ title: event.target.value })}
                              />
                              <textarea
                                className="table-input table-textarea"
                                placeholder="หมายเหตุ"
                                value={editForm.note}
                                onChange={(event) => updateEditForm({ note: event.target.value })}
                              />
                            </div>
                          </td>
                          <td>
                            <select
                              className="table-input"
                              value={editForm.category}
                              onChange={(event) => updateEditForm({ category: event.target.value })}
                            >
                              {categories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="table-input"
                              required
                              min="0"
                              step="0.001"
                              type="number"
                              value={editForm.amount}
                              onChange={(event) => updateEditForm({ amount: event.target.value })}
                            />
                          </td>
                          <td>
                            <div className="table-actions">
                              <button type="button" disabled={updating} onClick={() => saveEdit(expense.id)}>
                                {updating ? "บันทึก..." : "บันทึก"}
                              </button>
                              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                                ยกเลิก
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{new Date(expense.expenseDate).toLocaleDateString("th-TH")}</td>
                          <td>
                            <strong>{expense.title}</strong>
                            <span>{expense.note || "-"}</span>
                          </td>
                          <td>{expense.category}</td>
                          <td>{money.format(expense.amount)}</td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="btn-ghost" onClick={() => startEdit(expense)}>
                                แก้ไข
                              </button>
                              <button type="button" className="btn-danger" onClick={() => deleteExpense(expense.id)}>ลบ</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
