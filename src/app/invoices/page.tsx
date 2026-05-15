"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { compareInvoiceNumbers } from "@/lib/invoice-sorting";

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
  paidAt: string | null;
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
  bookNumber: string;
  documentNumber: string;
  customerId: string;
  salespersonId: string;
  total: string;
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
const statusBadgeClass = (status: string) => {
  const normalized = normalizeStatus(status);
  if (normalized === "ชำระแล้ว") return "status-badge status-badge--paid";
  if (normalized === "ยกเลิก") return "status-badge status-badge--cancelled";
  return "status-badge status-badge--pending";
};
const toDateInputValue = (date: string | null) => (date ? new Date(date).toISOString().slice(0, 10) : "");

// Parse "เล่มที่ 008 เลขที่ 0362" → { book: "008", doc: "0362" }. Fallback: doc holds the whole string.
const parseInvoiceNumber = (raw: string): { book: string; doc: string } => {
  if (!raw) return { book: "", doc: "" };
  const m = raw.match(/เล่มที่\s*(\S+)\s*เลขที่\s*(\S+)/);
  if (m) return { book: m[1], doc: m[2] };
  return { book: "", doc: raw };
};
const buildInvoiceNumber = (book: string, doc: string) => {
  const b = book.trim();
  const d = doc.trim();
  if (b && d) return `เล่มที่ ${b} เลขที่ ${d}`;
  return d || b;
};

export default function InvoicesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<InvoiceEditForm | null>(null);
  const [receivingPaymentId, setReceivingPaymentId] = useState<number | null>(null);
  const [receivingPaymentDate, setReceivingPaymentDate] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    bookNumber: "",
    documentNumber: "",
    customerId: "",
    salespersonId: "",
    total: "",
    status: "รอชำระ",
    dueDate: "",
  });
  const invoiceTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    [invoices],
  );

  type StatusTab = "all" | "open" | "overdue" | "paid";
  const [statusTab, setStatusTab] = useState<StatusTab>("all");

  // Categorize each invoice (memoized): all / open (รอชำระ, ยังไม่เกิน) / overdue (รอชำระ, เกินกำหนด) / paid
  const tabStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const stats = {
      all: { count: 0, total: 0 },
      open: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
    };
    const tagged = invoices.map((inv) => {
      const norm = normalizeStatus(inv.status);
      let tab: Exclude<StatusTab, "all">;
      if (norm === "ชำระแล้ว") tab = "paid";
      else if (norm === "ยกเลิก") tab = "open"; // ยกเลิกถือเป็นยังไม่ปิดยอด แต่ไม่ overdue
      else {
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        if (due) due.setHours(0, 0, 0, 0);
        tab = due && due.getTime() < today.getTime() ? "overdue" : "open";
      }
      stats.all.count += 1;
      stats.all.total += inv.total;
      stats[tab].count += 1;
      stats[tab].total += inv.total;
      return { invoice: inv, tab };
    });
    return { stats, tagged };
  }, [invoices]);

  const sortedInvoices = useMemo(() => {
    const filtered = tabStats.tagged
      .filter(({ tab }) => statusTab === "all" || tab === statusTab)
      .map(({ invoice }) => invoice);
    return filtered.sort(
      (a, b) => compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber) || a.id - b.id,
    );
  }, [tabStats, statusTab]);

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

  useEffect(() => {
    const editing = editingId !== null && editForm !== null;
    if (!formOpen && !editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (formOpen) setFormOpen(false);
        if (editing) cancelEdit();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [formOpen, editingId, editForm]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const invoiceNumber = buildInvoiceNumber(form.bookNumber, form.documentNumber);
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        customerId: Number(form.customerId),
        salespersonId: Number(form.salespersonId),
        total: Number(form.total),
        commissionTons: 0,
        commissionRate: 0,
        status: form.status,
        dueDate: form.dueDate,
      }),
    });

    if (response.ok) {
      setForm({
        bookNumber: "",
        documentNumber: "",
        customerId: "",
        salespersonId: "",
        total: "",
        status: "รอชำระ",
        dueDate: "",
      });
      setFormOpen(false);
      await fetchData();
    }

    setSaving(false);
  };

  const startEdit = (invoice: Invoice) => {
    const parts = parseInvoiceNumber(invoice.invoiceNumber);
    setEditingId(invoice.id);
    setEditForm({
      bookNumber: parts.book,
      documentNumber: parts.doc,
      customerId: String(invoice.customer.id),
      salespersonId: String(invoice.salesperson.id),
      total: String(invoice.total),
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

    const invoiceNumber = buildInvoiceNumber(editForm.bookNumber, editForm.documentNumber);
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        customerId: Number(editForm.customerId),
        salespersonId: Number(editForm.salespersonId),
        total: Number(editForm.total),
        status: editForm.status,
        dueDate: editForm.dueDate,
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

  const deleteInvoice = async (id: number) => {
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    await fetchData();
  };

  const markPaymentReceived = async (id: number, paidDate: string) => {
    if (!paidDate) return;
    
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        status: "ชำระแล้ว",
        paidAt: paidDate 
      }),
    });
    
    if (response.ok) {
      setReceivingPaymentId(null);
      setReceivingPaymentDate("");
      await fetchData();
    }
  };

  const cancelPaymentReceived = async (id: number) => {
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        status: "รอชำระ",
        paidAt: null 
      }),
    });
    
    if (response.ok) {
      await fetchData();
    }
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

      <section className="workspace-grid invoices-workspace is-form-collapsed">
        {formOpen && (
        <div className="modal-backdrop" onClick={() => setFormOpen(false)} role="presentation">
          <form
            className="panel form invoice-form modal-card"
            onSubmit={handleSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="form-header-row">
              <h2>สร้างใบแจ้งหนี้</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setFormOpen(false)}
                title="ปิด"
                aria-label="ปิดฟอร์ม"
              >
                ✕
              </button>
            </div>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">เล่มที่</span>
                <input
                  required
                  placeholder="เช่น 008"
                  value={form.bookNumber}
                  onChange={(event) => setForm({ ...form, bookNumber: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">เลขที่</span>
                <input
                  required
                  placeholder="เช่น 0362"
                  value={form.documentNumber}
                  onChange={(event) => setForm({ ...form, documentNumber: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">ลูกค้า</span>
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
            </label>
            <label className="field">
              <span className="field-label">เซลส์</span>
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
            </label>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">ยอดรวม (บาท)</span>
                <input
                  required
                  min="0"
                  step="0.001"
                  type="number"
                  placeholder="0.00"
                  value={form.total}
                  onChange={(event) => setForm({ ...form, total: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">วันครบกำหนด</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </label>
            </div>
            <input type="hidden" value={form.status} />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setFormOpen(false)}>
                ยกเลิก
              </button>
              <button type="submit" disabled={saving || customers.length === 0 || salespeople.length === 0}>
                {saving ? "กำลังบันทึก..." : "บันทึกใบแจ้งหนี้"}
              </button>
            </div>
            {(customers.length === 0 || salespeople.length === 0) && (
              <p className="muted">ต้องมีลูกค้าและเซลส์อย่างน้อยอย่างละ 1 รายก่อนสร้างใบแจ้งหนี้</p>
            )}
          </form>
        </div>
        )}

        {editingId !== null && editForm && (
        <div className="modal-backdrop" onClick={cancelEdit} role="presentation">
          <form
            className="panel form invoice-form modal-card"
            onSubmit={(event) => {
              event.preventDefault();
              if (editingId !== null) saveEdit(editingId);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="form-header-row">
              <h2>แก้ไขใบแจ้งหนี้</h2>
              <button
                type="button"
                className="icon-btn"
                onClick={cancelEdit}
                title="ปิด"
                aria-label="ปิดฟอร์ม"
              >
                ✕
              </button>
            </div>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">เล่มที่</span>
                <input
                  required
                  placeholder="เช่น 008"
                  value={editForm.bookNumber}
                  onChange={(event) => updateEditForm({ bookNumber: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">เลขที่</span>
                <input
                  required
                  placeholder="เช่น 0362"
                  value={editForm.documentNumber}
                  onChange={(event) => updateEditForm({ documentNumber: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">ลูกค้า</span>
              <select
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
            </label>
            <label className="field">
              <span className="field-label">เซลส์</span>
              <select
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
            </label>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">ยอดรวม (บาท)</span>
                <input
                  required
                  min="0"
                  step="0.001"
                  type="number"
                  value={editForm.total}
                  onChange={(event) => updateEditForm({ total: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">วันครบกำหนด</span>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(event) => updateEditForm({ dueDate: event.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span className="field-label">สถานะ</span>
              <select
                value={editForm.status}
                onChange={(event) => updateEditForm({ status: event.target.value })}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={cancelEdit}>
                ยกเลิก
              </button>
              <button type="submit" disabled={updating}>
                {updating ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
        )}

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ทั้งหมด {invoices.length} ใบ</p>
              <h2>รายการใบแจ้งหนี้</h2>
            </div>
            {!formOpen && (
              <button
                type="button"
                className="primary create-toggle"
                onClick={() => setFormOpen(true)}
              >
                + สร้างใบแจ้งหนี้
              </button>
            )}
          </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : (
            <>
              <div className="invoice-tabs" role="tablist" aria-label="กรองตามสถานะ">
                {([
                  { key: "all", label: "ทั้งหมด" },
                  { key: "open", label: "ค้างชำระ" },
                  { key: "overdue", label: "เกินกำหนด" },
                  { key: "paid", label: "ชำระแล้ว" },
                ] as { key: StatusTab; label: string }[]).map(({ key, label }) => {
                  const s = tabStats.stats[key];
                  const active = statusTab === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`invoice-tab invoice-tab--${key}${active ? " is-active" : ""}`}
                      onClick={() => setStatusTab(key)}
                    >
                      <span className="invoice-tab__label">{label}</span>
                      <span className="invoice-tab__count">{s.count} ใบ</span>
                      <span className="invoice-tab__total">{money.format(s.total)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="table-wrap">
              <table className="table invoices-table">
                <colgroup>
                  <col className="col-book" />
                  <col className="col-doc" />
                  <col className="col-due" />
                  <col className="col-customer" />
                  <col className="col-sales" />
                  <col className="col-total" />
                  <col className="col-status" />
                  <col className="col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>เล่มที่</th>
                    <th>เลขที่</th>
                    <th>ครบกำหนด</th>
                    <th>ลูกค้า</th>
                    <th>เซลส์</th>
                    <th className="num">ยอดรวม</th>
                    <th>สถานะ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map((invoice) => (
                    <tr key={invoice.id}>
                      {(() => {
                        const parts = parseInvoiceNumber(invoice.invoiceNumber);
                        return (
                          <>
                            <td>
                              <strong className="cell-strong">{parts.book || "-"}</strong>
                            </td>
                            <td>
                              <strong className="cell-strong">{parts.doc || invoice.invoiceNumber}</strong>
                            </td>
                          </>
                        );
                      })()}
                      <td className="col-due-cell">
                        {invoice.dueDate ? (
                          <span className="cell-strong">{new Date(invoice.dueDate).toLocaleDateString("th-TH")}</span>
                        ) : (
                          <span className="cell-sub">ไม่ระบุ</span>
                        )}
                      </td>
                      <td>
                        <strong className="cell-strong">{invoice.customer.name}</strong>
                      </td>
                      <td>
                        <span className="cell-strong">{invoice.salesperson.name}</span>
                      </td>
                      <td className="num">{money.format(invoice.total)}</td>
                      <td>
                        <div className="status-cell">
                          <span className={statusBadgeClass(invoice.status)}>{normalizeStatus(invoice.status)}</span>
                          {invoice.status === "รอชำระ" && receivingPaymentId !== invoice.id ? (
                            <button type="button" className="receive-link" onClick={() => setReceivingPaymentId(invoice.id)}>
                              + บันทึกการรับชำระ
                            </button>
                          ) : null}
                          {invoice.status === "ชำระแล้ว" && invoice.paidAt ? (
                            <>
                              <span className="cell-sub">ชำระ {new Date(invoice.paidAt).toLocaleDateString("th-TH")}</span>
                              <button type="button" className="receive-link" onClick={() => cancelPaymentReceived(invoice.id)}>
                                ยกเลิกรับชำระ
                              </button>
                            </>
                          ) : null}
                          {receivingPaymentId === invoice.id ? (
                            <div className="receive-box">
                              <input
                                type="date"
                                aria-label="วันที่ชำระ"
                                value={receivingPaymentDate}
                                onChange={(event) => setReceivingPaymentDate(event.target.value)}
                              />
                              <div className="table-actions table-actions--compact">
                                <button type="button" onClick={() => markPaymentReceived(invoice.id, receivingPaymentDate)} disabled={!receivingPaymentDate}>
                                  ยืนยัน
                                </button>
                                <button type="button" className="btn-ghost" onClick={() => {
                                  setReceivingPaymentId(null);
                                  setReceivingPaymentDate("");
                                }}>
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="icon-btn" title="แก้ไข" aria-label="แก้ไข" onClick={() => startEdit(invoice)}>
                            ✎
                          </button>
                          <button type="button" className="icon-btn icon-btn--danger" title="ลบ" aria-label="ลบ" onClick={() => deleteInvoice(invoice.id)}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
