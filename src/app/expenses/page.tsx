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

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const categories = ["ค่าขนส่ง", "ค่าแรง", "ค่าน้ำมัน", "ค่าเช่า", "สำนักงาน", "อื่น ๆ"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "ค่าขนส่ง",
    amount: "",
    expenseDate: "",
    note: "",
  });

  const total = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

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
          <span>ค่าใช้จ่ายรวม</span>
          <strong>{money.format(total)}</strong>
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
              <p className="eyebrow">ทั้งหมด {expenses.length} รายการ</p>
              <h2>ประวัติค่าใช้จ่าย</h2>
            </div>
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
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
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{new Date(expense.expenseDate).toLocaleDateString("th-TH")}</td>
                      <td>
                        <strong>{expense.title}</strong>
                        <span>{expense.note || "-"}</span>
                      </td>
                      <td>{expense.category}</td>
                      <td>{money.format(expense.amount)}</td>
                      <td>
                        <button className="btn-danger" onClick={() => deleteExpense(expense.id)}>ลบ</button>
                      </td>
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
