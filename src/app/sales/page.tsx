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

type SalespersonEditForm = {
  name: string;
  email: string;
  phone: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SalesPage() {
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SalespersonEditForm | null>(null);
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

  const startEdit = (person: Salesperson) => {
    setEditingId(person.id);
    setEditForm({
      name: person.name,
      email: person.email || "",
      phone: person.phone || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<SalespersonEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/salespeople/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (response.ok) {
      cancelEdit();
      await fetchSalespeople();
    }

    setUpdating(false);
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
                        {editingId === person.id && editForm ? (
                          <>
                            <td>
                              <div className="table-field-stack">
                                <input
                                  className="table-input"
                                  required
                                  placeholder="ชื่อเซลส์"
                                  value={editForm.name}
                                  onChange={(event) => updateEditForm({ name: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  type="email"
                                  placeholder="อีเมล"
                                  value={editForm.email}
                                  onChange={(event) => updateEditForm({ email: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="เบอร์โทร"
                                  value={editForm.phone}
                                  onChange={(event) => updateEditForm({ phone: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>{money.format(totalSales)}</td>
                            <td>{money.format(totalCommissions)}</td>
                            <td>{money.format(unpaidCommissions)}</td>
                            <td>
                              <div className="table-actions">
                                <button type="button" disabled={updating} onClick={() => saveEdit(person.id)}>
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
                            <td>
                              <strong>{person.name}</strong>
                              <span>{person.email || person.phone || "-"}</span>
                            </td>
                            <td>{money.format(totalSales)}</td>
                            <td>{money.format(totalCommissions)}</td>
                            <td>{money.format(unpaidCommissions)}</td>
                            <td>
                              <div className="table-actions">
                                <button type="button" className="btn-ghost" onClick={() => startEdit(person)}>
                                  แก้ไข
                                </button>
                                <button type="button" className="btn-danger" onClick={() => deleteSalesperson(person.id)}>
                                  ลบ
                                </button>
                              </div>
                            </td>
                          </>
                        )}
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
