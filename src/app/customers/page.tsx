"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoices: Array<{ total: number }>;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers");
    const data = await response.json();
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword)),
    );
  }, [customers, search]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setForm({ name: "", phone: "", email: "", address: "" });
      await fetchCustomers();
    }

    setSaving(false);
  };

  const importSaleRecordCustomers = async () => {
    setImporting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/customers/import-sale-records", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "นำเข้ารายชื่อลูกค้าสำเร็จ");
        await fetchCustomers();
      } else {
        setError(data.error || "ไม่สามารถนำเข้ารายชื่อลูกค้าได้");
      }
    } catch {
      setError("ไม่สามารถนำเข้ารายชื่อลูกค้าได้");
    }

    setImporting(false);
  };

  const deleteCustomer = async (id: number) => {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await fetchCustomers();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ลูกค้า</p>
          <h1>จัดการลูกค้า</h1>
        </div>
      </header>

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>เพิ่มลูกค้าใหม่</h2>
          <input
            required
            placeholder="ชื่อลูกค้า"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <input
            placeholder="เบอร์โทร"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <input
            placeholder="อีเมล"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
          <input
            placeholder="ที่อยู่"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกลูกค้า"}</button>
        </form>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ทั้งหมด {customers.length} ราย</p>
              <h2>รายชื่อลูกค้า</h2>
            </div>
            <button type="button" className="btn-ghost" onClick={importSaleRecordCustomers} disabled={importing}>
              {importing ? "กำลังดึง..." : "ดึงจากรายการขาย"}
            </button>
            <input
              className="search-input"
              placeholder="ค้นหาลูกค้า"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : (
            <>
            {message && <p className="muted" style={{ color: "var(--success, #059669)" }}>{message}</p>}
            {error && <p className="muted" style={{ color: "#dc2626" }}>{error}</p>}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>ติดต่อ</th>
                    <th>ใบแจ้งหนี้</th>
                    <th>ยอดขาย</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => {
                    const total = customer.invoices.reduce((sum, invoice) => sum + invoice.total, 0);

                    return (
                      <tr key={customer.id}>
                        <td>
                          <strong>{customer.name}</strong>
                          <span>{customer.address || "-"}</span>
                        </td>
                        <td>
                          {customer.phone || "-"}
                          <span>{customer.email || "-"}</span>
                        </td>
                        <td>{customer.invoices.length}</td>
                        <td>{money.format(total)}</td>
                        <td>
                          <button className="btn-danger" onClick={() => deleteCustomer(customer.id)}>
                            ลบ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </section>
    </div>
  );
}
