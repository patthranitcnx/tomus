"use client";

import { FormEvent, useEffect, useState } from "react";

type Customer = {
  id: number;
  name: string;
};

type Salesperson = {
  id: number;
  name: string;
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  total: number;
  commissionRate: number;
  status: string;
  dueDate: string | null;
  customer: Customer;
  salesperson: Salesperson;
  commission: {
    id: number;
    amount: number;
    paid: boolean;
  } | null;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const statusOptions = ["PENDING", "PAID", "CANCELLED"];

export default function InvoicesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    customerId: "",
    salespersonId: "",
    total: "",
    commissionRate: "3",
    status: "PENDING",
    dueDate: "",
  });

  const fetchData = async () => {
    const [customerResponse, salesResponse, invoiceResponse] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/salespeople"),
      fetch("/api/invoices"),
    ]);

    const [customerData, salesData, invoiceData] = await Promise.all([
      customerResponse.json(),
      salesResponse.json(),
      invoiceResponse.json(),
    ]);

    setCustomers(Array.isArray(customerData) ? customerData : []);
    setSalespeople(Array.isArray(salesData) ? salesData : []);
    setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        customerId: Number(form.customerId),
        salespersonId: Number(form.salespersonId),
        total: Number(form.total),
        commissionRate: Number(form.commissionRate),
      }),
    });

    if (response.ok) {
      setForm({
        invoiceNumber: "",
        customerId: "",
        salespersonId: "",
        total: "",
        commissionRate: "3",
        status: "PENDING",
        dueDate: "",
      });
      await fetchData();
    }

    setSaving(false);
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchData();
  };

  const updateCommissionPaid = async (id: number, paid: boolean) => {
    await fetch(`/api/commissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    await fetchData();
  };

  const deleteInvoice = async (id: number) => {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    await fetchData();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ใบแจ้งหนี้</p>
          <h1>บัญชีและใบแจ้งหนี้</h1>
        </div>
      </header>

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <h2>สร้างใบแจ้งหนี้</h2>
          <input
            required
            placeholder="เลขที่ใบแจ้งหนี้ เช่น INV-0001"
            value={form.invoiceNumber}
            onChange={(event) => setForm({ ...form, invoiceNumber: event.target.value })}
          />
          <select
            required
            value={form.customerId}
            onChange={(event) => setForm({ ...form, customerId: event.target.value })}
          >
            <option value="">เลือกลูกค้า</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <select
            required
            value={form.salespersonId}
            onChange={(event) => setForm({ ...form, salespersonId: event.target.value })}
          >
            <option value="">เลือกเซลส์</option>
            {salespeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <input
            required
            min="0"
            step="0.001"
            type="number"
            placeholder="ยอดรวม"
            value={form.total}
            onChange={(event) => setForm({ ...form, total: event.target.value })}
          />
          <input
            required
            min="0"
            step="0.001"
            type="number"
            placeholder="อัตราคอมมิชชั่น (%)"
            value={form.commissionRate}
            onChange={(event) => setForm({ ...form, commissionRate: event.target.value })}
          />
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
          />
          <button disabled={saving || customers.length === 0 || salespeople.length === 0}>
            {saving ? "กำลังบันทึก..." : "บันทึกใบแจ้งหนี้"}
          </button>
          {(customers.length === 0 || salespeople.length === 0) && (
            <p className="muted">ต้องมีลูกค้าและเซลส์อย่างน้อยอย่างละ 1 รายก่อนสร้างใบแจ้งหนี้</p>
          )}
        </form>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ทั้งหมด {invoices.length} ใบ</p>
              <h2>รายการใบแจ้งหนี้</h2>
            </div>
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>เลขที่</th>
                    <th>ลูกค้า / เซลส์</th>
                    <th>ยอดรวม</th>
                    <th>สถานะ</th>
                    <th>คอมมิชชั่น</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.invoiceNumber}</strong>
                        <span>{invoice.dueDate ? `ครบกำหนด ${new Date(invoice.dueDate).toLocaleDateString("th-TH")}` : "ไม่ระบุวันครบกำหนด"}</span>
                      </td>
                      <td>
                        {invoice.customer.name}
                        <span>{invoice.salesperson.name}</span>
                      </td>
                      <td>{money.format(invoice.total)}</td>
                      <td>
                        <select
                          className="inline-select"
                          value={invoice.status}
                          onChange={(event) => updateStatus(invoice.id, event.target.value)}
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {invoice.commission ? (
                          <label className="check-row">
                            <input
                              type="checkbox"
                              checked={invoice.commission.paid}
                              onChange={(event) => updateCommissionPaid(invoice.commission!.id, event.target.checked)}
                            />
                            {money.format(invoice.commission.amount)}
                          </label>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <button className="btn-danger" onClick={() => deleteInvoice(invoice.id)}>
                          ลบ
                        </button>
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
