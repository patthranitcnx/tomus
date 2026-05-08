"use client";

import { FormEvent, useEffect, useState } from "react";

type Salesperson = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  invoices: Array<{ total: number }>;
  commissions: Array<{ amount: number; paid: boolean }>;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

export default function SalesPage() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const fetchSalespeople = async () => {
    const response = await fetch("/api/salespeople");
    const data = await response.json();
    setSalespeople(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSalespeople();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/salespeople", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setForm({ name: "", email: "", phone: "" });
      await fetchSalespeople();
    }

    setSaving(false);
  };

  const deleteSalesperson = async (id: number) => {
    await fetch(`/api/salespeople/${id}`, { method: "DELETE" });
    await fetchSalespeople();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ทีมขาย</p>
          <h1>ผลงานเซลส์และคอมมิชชั่น</h1>
        </div>
      </header>

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>เพิ่มเซลส์</h2>
          <input
            required
            placeholder="ชื่อเซลส์"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            placeholder="อีเมล"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <input
            placeholder="เบอร์โทร"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกเซลส์"}</button>
        </form>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ทั้งหมด {salespeople.length} คน</p>
              <h2>ผลงานทีมขาย</h2>
            </div>
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>ยอดขาย</th>
                    <th>คอมมิชชั่นรวม</th>
                    <th>ค้างจ่าย</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {salespeople.map((person) => {
                    const totalSales = person.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
                    const totalCommissions = person.commissions.reduce((sum, commission) => sum + commission.amount, 0);
                    const unpaidCommissions = person.commissions
                      .filter((commission) => !commission.paid)
                      .reduce((sum, commission) => sum + commission.amount, 0);

                    return (
                      <tr key={person.id}>
                        <td>
                          <strong>{person.name}</strong>
                          <span>{person.email || person.phone || "-"}</span>
                        </td>
                        <td>{money.format(totalSales)}</td>
                        <td>{money.format(totalCommissions)}</td>
                        <td>{money.format(unpaidCommissions)}</td>
                        <td>
                          <button className="btn-danger" onClick={() => deleteSalesperson(person.id)}>
                            ลบ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
