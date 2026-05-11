"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  commissionTons: number;
  status: string;
  dueDate: string | null;
  customer: Customer;
  salesperson: Salesperson;
  commission: {
    id: number;
    amount: number;
    paid: boolean;
    paidAt: string | null;
  } | null;
};

type InvoiceEditForm = {
  invoiceNumber: string;
  customerId: string;
  salespersonId: string;
  total: string;
  commissionRate: string;
  commissionTons: string;
  status: string;
  dueDate: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const statusOptions = [
  { value: "รอชำระ", label: "รอชำระ" },
  { value: "ชำระแล้ว", label: "ชำระแล้ว" },
  { value: "ยกเลิก", label: "ยกเลิก" },
];
const statusLabelMap: Record<string, string> = {
  PENDING: "รอชำระ",
  PAID: "ชำระแล้ว",
  CANCELLED: "ยกเลิก",
  "รอชำระ": "รอชำระ",
  "ชำระแล้ว": "ชำระแล้ว",
  "ยกเลิก": "ยกเลิก",
};
const normalizeStatus = (status: string) => statusLabelMap[status] ?? "รอชำระ";
const toDateInputValue = (date: string | null) => (date ? new Date(date).toISOString().slice(0, 10) : "");

export default function InvoicesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<InvoiceEditForm | null>(null);
  const [form, setForm] = useState({
    invoiceNumber: "",
    customerId: "",
    salespersonId: "",
    total: "",
    commissionTons: "",
    commissionRate: "",
    status: "รอชำระ",
    dueDate: "",
  });
  const invoiceTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    [invoices],
  );

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
        commissionTons: Number(form.commissionTons),
        commissionRate: Number(form.commissionRate),
      }),
    });

    if (response.ok) {
      setForm({
        invoiceNumber: "",
        customerId: "",
        salespersonId: "",
        total: "",
        commissionTons: "",
        commissionRate: "",
        status: "รอชำระ",
        dueDate: "",
      });
      await fetchData();
    }

    setSaving(false);
  };

  const startEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setEditForm({
      invoiceNumber: invoice.invoiceNumber,
      customerId: String(invoice.customer.id),
      salespersonId: String(invoice.salesperson.id),
      total: String(invoice.total),
      commissionTons: String(invoice.commissionTons),
      commissionRate: String(invoice.commissionRate),
      status: normalizeStatus(invoice.status),
      dueDate: toDateInputValue(invoice.dueDate),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<InvoiceEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        customerId: Number(editForm.customerId),
        salespersonId: Number(editForm.salespersonId),
        total: Number(editForm.total),
        commissionTons: Number(editForm.commissionTons),
        commissionRate: Number(editForm.commissionRate),
      }),
    });

    if (response.ok) {
      cancelEdit();
      await fetchData();
    }

    setUpdating(false);
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
        <article className="mini-total">
          <span>ยอดรวมใบแจ้งหนี้</span>
          <strong>{money.format(invoiceTotal)}</strong>
        </article>
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
            placeholder="จำนวนตันที่คิดคอมมิชชั่น"
            value={form.commissionTons}
            onChange={(event) => setForm({ ...form, commissionTons: event.target.value })}
          />
          <input
            required
            min="0"
            step="0.001"
            type="number"
            placeholder="คอมมิชชั่นบาทต่อตัน"
            value={form.commissionRate}
            onChange={(event) => setForm({ ...form, commissionRate: event.target.value })}
          />
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
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
                    <th>จำนวนตัน</th>
                    <th>สถานะ</th>
                    <th>คอมมิชชั่น</th>
                    <th>ชำระค่าคอมมิชชั่น</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      {editingId === invoice.id && editForm ? (
                        <>
                          <td>
                            <div className="table-field-stack">
                              <input
                                className="table-input"
                                required
                                placeholder="เลขที่ใบแจ้งหนี้"
                                value={editForm.invoiceNumber}
                                onChange={(event) => updateEditForm({ invoiceNumber: event.target.value })}
                              />
                              <input
                                className="table-input"
                                type="date"
                                value={editForm.dueDate}
                                onChange={(event) => updateEditForm({ dueDate: event.target.value })}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="table-field-stack">
                              <select
                                className="table-input"
                                required
                                value={editForm.customerId}
                                onChange={(event) => updateEditForm({ customerId: event.target.value })}
                              >
                                {customers.map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                className="table-input"
                                required
                                value={editForm.salespersonId}
                                onChange={(event) => updateEditForm({ salespersonId: event.target.value })}
                              >
                                {salespeople.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    {person.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div className="table-field-stack table-field-stack--small">
                              <input
                                className="table-input"
                                required
                                min="0"
                                step="0.001"
                                type="number"
                                value={editForm.total}
                                onChange={(event) => updateEditForm({ total: event.target.value })}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="table-field-stack table-field-stack--small">
                              <input
                                className="table-input"
                                required
                                min="0"
                                step="0.001"
                                type="number"
                                value={editForm.commissionTons}
                                onChange={(event) => updateEditForm({ commissionTons: event.target.value })}
                              />
                              <input
                                className="table-input"
                                required
                                min="0"
                                step="0.001"
                                type="number"
                                value={editForm.commissionRate}
                                onChange={(event) => updateEditForm({ commissionRate: event.target.value })}
                              />
                            </div>
                          </td>
                          <td>
                            <select
                              className="inline-select"
                              value={editForm.status}
                              onChange={(event) => updateEditForm({ status: event.target.value })}
                            >
                              {statusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{money.format((Number(editForm.commissionTons) || 0) * (Number(editForm.commissionRate) || 0))}</td>
                          <td>
                            <span>บันทึกก่อน</span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <button type="button" disabled={updating} onClick={() => saveEdit(invoice.id)}>
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
                            <strong>{invoice.invoiceNumber}</strong>
                            <span>{invoice.dueDate ? `ครบกำหนด ${new Date(invoice.dueDate).toLocaleDateString("th-TH")}` : "ไม่ระบุวันครบกำหนด"}</span>
                          </td>
                          <td>
                            {invoice.customer.name}
                            <span>{invoice.salesperson.name}</span>
                          </td>
                          <td>{money.format(invoice.total)}</td>
                          <td>
                            {invoice.commissionTons.toLocaleString("th-TH", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 3,
                            })}{" "}
                            ตัน
                            <span>{money.format(invoice.commissionRate)} / ตัน</span>
                          </td>
                          <td>
                            <select
                              className="inline-select"
                              value={normalizeStatus(invoice.status)}
                              onChange={(event) => updateStatus(invoice.id, event.target.value)}
                            >
                              {statusOptions.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {invoice.commission ? money.format(invoice.commission.amount) : "-"}
                          </td>
                          <td>
                            {invoice.commission ? (
                              <label className="check-row">
                                <input
                                  type="checkbox"
                                  checked={invoice.commission.paid}
                                  onChange={(event) => updateCommissionPaid(invoice.commission!.id, event.target.checked)}
                                />
                                <span>
                                  {invoice.commission.paid ? "เรียบร้อย" : "ยังไม่ชำระ"}
                                  {invoice.commission.paidAt
                                    ? ` ${new Date(invoice.commission.paidAt).toLocaleDateString("th-TH")}`
                                    : ""}
                                </span>
                              </label>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="btn-ghost" onClick={() => startEdit(invoice)}>
                                แก้ไข
                              </button>
                              <button type="button" className="btn-danger" onClick={() => deleteInvoice(invoice.id)}>
                                ลบ
                              </button>
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
