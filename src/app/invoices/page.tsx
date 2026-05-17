"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { compareInvoiceNumbers } from "@/lib/invoice-sorting";
import { formatThaiDate } from "@/lib/format-date";

type Customer = {
  id: number;
  name: string;
};

type Salesperson = {
  id: number;
  name: string;
};

type InvoiceItem = {
  id: number;
  itemName: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  position: number;
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
  items: InvoiceItem[];
  note: string | null;
  saleDate: string | null;
  paymentDates: string[];
  paymentAmounts: number[];
  needsReview: boolean;
  reviewNotes: string | null;
  customer: Customer;
  salesperson: Salesperson;
  commission: {
    id: number;
    amount: number;
    paid: boolean;
    paidAt: string | null;
  } | null;
};

type ItemFormRow = {
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type InvoiceEditForm = {
  bookNumber: string;
  documentNumber: string;
  customerId: string;
  salespersonId: string;
  commissionTons: string;
  commissionRate: string;
  status: string;
  dueDate: string;
  items: ItemFormRow[];
  note: string;
  saleDate: string;
};

const emptyItemRow = (): ItemFormRow => ({ itemName: "", quantity: "", unit: "", unitPrice: "" });
const computeRowsTotal = (rows: ItemFormRow[]) =>
  rows.reduce((sum, row) => {
    const q = Number(row.quantity);
    const p = Number(row.unitPrice);
    if (Number.isFinite(q) && Number.isFinite(p)) return sum + q * p;
    return sum;
  }, 0);
const itemRowsToPayload = (rows: ItemFormRow[]) =>
  rows
    .map((row) => ({
      itemName: row.itemName.trim(),
      quantity: Number(row.quantity),
      unit: row.unit.trim() || null,
      unitPrice: Number(row.unitPrice),
    }))
    .filter(
      (row) =>
        row.itemName.length > 0 &&
        Number.isFinite(row.quantity) &&
        row.quantity >= 0 &&
        Number.isFinite(row.unitPrice) &&
        row.unitPrice >= 0,
    );

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
  const [editError, setEditError] = useState("");
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
    commissionTons: "",
    commissionRate: "",
    status: "รอชำระ",
    dueDate: "",
    items: [emptyItemRow()] as ItemFormRow[],
    note: "",
    saleDate: "",
  });
  const formTotal = useMemo(() => computeRowsTotal(form.items), [form.items]);
  const editTotal = useMemo(() => (editForm ? computeRowsTotal(editForm.items) : 0), [editForm]);
  const invoiceTotal = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    [invoices],
  );

  type StatusTab = "all" | "open" | "overdue" | "paid" | "review";
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
      review: { count: 0, total: 0 },
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
      if (inv.needsReview) {
        stats.review.count += 1;
        stats.review.total += inv.total;
      }
      return { invoice: inv, tab };
    });
    return { stats, tagged };
  }, [invoices]);

  const sortedInvoices = useMemo(() => {
    const filtered = tabStats.tagged
      .filter(({ invoice, tab }) => {
        if (statusTab === "all") return true;
        if (statusTab === "review") return invoice.needsReview;
        return tab === statusTab;
      })
      .map(({ invoice }) => invoice);
    return filtered.sort(
      (a, b) => compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber) || a.id - b.id,
    );
  }, [tabStats, statusTab]);

  const fetchData = async () => {
    const [customerResponse, salesResponse, invoiceResponse] = await Promise.all([
      fetch("/api/customers?lite=1"),
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
    const items = itemRowsToPayload(form.items);
    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber,
        customerId: Number(form.customerId),
        salespersonId: Number(form.salespersonId),
        items,
        commissionTons: Number(form.commissionTons) || 0,
        commissionRate: Number(form.commissionRate) || 0,
        status: form.status,
        dueDate: form.dueDate,
        note: form.note.trim() || null,
        saleDate: form.saleDate || null,
      }),
    });

    if (response.ok) {
      setForm({
        bookNumber: "",
        documentNumber: "",
        customerId: "",
        salespersonId: "",
        commissionTons: "",
        commissionRate: "",
        status: "รอชำระ",
        dueDate: "",
        items: [emptyItemRow()],
        note: "",
        saleDate: "",
      });
      setFormOpen(false);
      await fetchData();
    }

    setSaving(false);
  };

  const startEdit = (invoice: Invoice) => {
    const parts = parseInvoiceNumber(invoice.invoiceNumber);
    const itemRows: ItemFormRow[] = invoice.items && invoice.items.length > 0
      ? invoice.items.map((item) => ({
          itemName: item.itemName,
          quantity: String(item.quantity),
          unit: item.unit ?? "",
          unitPrice: String(item.unitPrice),
        }))
      : [emptyItemRow()];
    setEditError("");
    setEditingId(invoice.id);
    setEditForm({
      bookNumber: parts.book,
      documentNumber: parts.doc,
      customerId: String(invoice.customer.id),
      salespersonId: String(invoice.salesperson.id),
      commissionTons: String(invoice.commissionTons),
      commissionRate: String(invoice.commissionRate),
      status: normalizeStatus(invoice.status),
      dueDate: toDateInputValue(invoice.dueDate),
      items: itemRows,
      note: invoice.note ?? "",
      saleDate: toDateInputValue(invoice.saleDate),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setEditError("");
  };

  const updateEditForm = (values: Partial<InvoiceEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const updateFormItem = (index: number, patch: Partial<ItemFormRow>) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };
  const addFormItem = () => setForm((current) => ({ ...current, items: [...current.items, emptyItemRow()] }));
  const removeFormItem = (index: number) =>
    setForm((current) => ({
      ...current,
      items: current.items.length <= 1 ? current.items : current.items.filter((_, i) => i !== index),
    }));

  const updateEditItem = (index: number, patch: Partial<ItemFormRow>) => {
    setEditForm((current) =>
      current
        ? { ...current, items: current.items.map((row, i) => (i === index ? { ...row, ...patch } : row)) }
        : current,
    );
  };
  const addEditItem = () =>
    setEditForm((current) => (current ? { ...current, items: [...current.items, emptyItemRow()] } : current));
  const removeEditItem = (index: number) =>
    setEditForm((current) =>
      current
        ? {
            ...current,
            items: current.items.length <= 1 ? current.items : current.items.filter((_, i) => i !== index),
          }
        : current,
    );

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);
    setEditError("");

    const invoiceNumber = buildInvoiceNumber(editForm.bookNumber, editForm.documentNumber);
    const items = itemRowsToPayload(editForm.items);
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber,
          customerId: Number(editForm.customerId),
          salespersonId: Number(editForm.salespersonId),
          items,
          commissionTons: Number(editForm.commissionTons) || 0,
          commissionRate: Number(editForm.commissionRate) || 0,
          status: editForm.status,
          dueDate: editForm.dueDate,
          note: editForm.note.trim() || null,
          saleDate: editForm.saleDate || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        setEditError(data?.error ?? "บันทึกการแก้ไขไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง");
        return;
      }

      const updatedInvoice = await response.json() as Invoice;
      setInvoices((currentInvoices) =>
        currentInvoices.map((invoice) => (invoice.id === id ? updatedInvoice : invoice)),
      );
      cancelEdit();
    } catch (error) {
      setEditError("เชื่อมต่อระบบบันทึกไม่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setUpdating(false);
    }
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

  const markReviewed = async (id: number) => {
    const response = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ needsReview: false, reviewNotes: null }),
    });
    if (response.ok) await fetchData();
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
              <span className="field-label">เซลส์ / ผู้รับคอมมิชชั่น</span>
              <select
                required
                value={form.salespersonId}
                onChange={(event) => setForm({ ...form, salespersonId: event.target.value })}
              >
                <option value="">เลือกผู้รับคอมมิชชั่น</option>
                {salespeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="items-editor">
              <div className="items-editor__head">
                <span className="field-label">รายการสินค้า</span>
                <button type="button" className="btn-ghost btn-ghost--sm" onClick={addFormItem}>
                  + เพิ่มรายการ
                </button>
              </div>
              {form.items.map((row, index) => (
                <div key={index} className="item-row">
                  <label className="field item-row__name">
                    <span className="field-label">ชื่อสินค้า</span>
                    <input
                      placeholder="เช่น ปุ๋ยสูตร 16-16-16"
                      value={row.itemName}
                      onChange={(event) => updateFormItem(index, { itemName: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__qty">
                    <span className="field-label">จำนวน</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.quantity}
                      onChange={(event) => updateFormItem(index, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__unit">
                    <span className="field-label">หน่วย</span>
                    <input
                      placeholder="ตัน"
                      value={row.unit}
                      onChange={(event) => updateFormItem(index, { unit: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__price">
                    <span className="field-label">ราคา/หน่วย</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.unitPrice}
                      onChange={(event) => updateFormItem(index, { unitPrice: event.target.value })}
                    />
                  </label>
                  <div className="field item-row__sub">
                    <span className="field-label">รวม</span>
                    <div className="item-row__sub-value">
                      {money.format((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger item-row__remove"
                    title="ลบรายการ"
                    aria-label="ลบรายการ"
                    onClick={() => removeFormItem(index)}
                    disabled={form.items.length <= 1}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <label className="field">
              <span className="field-label">วันที่ขาย</span>
              <input
                type="date"
                value={form.saleDate}
                onChange={(event) => setForm({ ...form, saleDate: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">หมายเหตุ</span>
              <textarea
                rows={2}
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
              />
            </label>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">จำนวนตันที่คิดคอมมิชชั่น</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  placeholder="0"
                  value={form.commissionTons}
                  onChange={(event) => setForm({ ...form, commissionTons: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">ค่าคอมมิชชั่น (บาท/ตัน)</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  placeholder="0.00"
                  value={form.commissionRate}
                  onChange={(event) => setForm({ ...form, commissionRate: event.target.value })}
                />
              </label>
            </div>
            <p className="field-note">
              ค่าคอมรวม {money.format((Number(form.commissionTons) || 0) * (Number(form.commissionRate) || 0))}
            </p>
            <div className="field-grid-2">
              <div className="field">
                <span className="field-label">ยอดรวม (บาท)</span>
                <div className="form-total-display">{money.format(formTotal)}</div>
              </div>
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
              <button
                type="submit"
                disabled={
                  saving ||
                  customers.length === 0 ||
                  salespeople.length === 0 ||
                  itemRowsToPayload(form.items).length === 0
                }
              >
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
            {(() => {
              const inv = invoices.find((i) => i.id === editingId);
              if (!inv || !inv.needsReview) return null;
              return (
                <div className="review-banner">
                  <div>
                    <strong>⚠ รายการนี้ต้องตรวจสอบ</strong>
                    {inv.reviewNotes ? <p className="cell-sub">{inv.reviewNotes}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => editingId !== null && markReviewed(editingId)}
                  >
                    ทำเครื่องหมายตรวจแล้ว
                  </button>
                </div>
              );
            })()}
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
              <span className="field-label">เซลส์ / ผู้รับคอมมิชชั่น</span>
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
            <div className="items-editor">
              <div className="items-editor__head">
                <span className="field-label">รายการสินค้า</span>
                <button type="button" className="btn-ghost btn-ghost--sm" onClick={addEditItem}>
                  + เพิ่มรายการ
                </button>
              </div>
              {editForm.items.map((row, index) => (
                <div key={index} className="item-row">
                  <label className="field item-row__name">
                    <span className="field-label">ชื่อสินค้า</span>
                    <input
                      value={row.itemName}
                      onChange={(event) => updateEditItem(index, { itemName: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__qty">
                    <span className="field-label">จำนวน</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.quantity}
                      onChange={(event) => updateEditItem(index, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__unit">
                    <span className="field-label">หน่วย</span>
                    <input
                      value={row.unit}
                      onChange={(event) => updateEditItem(index, { unit: event.target.value })}
                    />
                  </label>
                  <label className="field item-row__price">
                    <span className="field-label">ราคา/หน่วย</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={row.unitPrice}
                      onChange={(event) => updateEditItem(index, { unitPrice: event.target.value })}
                    />
                  </label>
                  <div className="field item-row__sub">
                    <span className="field-label">รวม</span>
                    <div className="item-row__sub-value">
                      {money.format((Number(row.quantity) || 0) * (Number(row.unitPrice) || 0))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger item-row__remove"
                    title="ลบรายการ"
                    aria-label="ลบรายการ"
                    onClick={() => removeEditItem(index)}
                    disabled={editForm.items.length <= 1}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
            <label className="field">
              <span className="field-label">วันที่ขาย</span>
              <input
                type="date"
                value={editForm.saleDate}
                onChange={(event) => updateEditForm({ saleDate: event.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">หมายเหตุ</span>
              <textarea
                rows={2}
                value={editForm.note}
                onChange={(event) => updateEditForm({ note: event.target.value })}
              />
            </label>
            <div className="field-grid-2">
              <label className="field">
                <span className="field-label">จำนวนตันที่คิดคอมมิชชั่น</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={editForm.commissionTons}
                  onChange={(event) => updateEditForm({ commissionTons: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field-label">ค่าคอมมิชชั่น (บาท/ตัน)</span>
                <input
                  min="0"
                  step="0.001"
                  type="number"
                  value={editForm.commissionRate}
                  onChange={(event) => updateEditForm({ commissionRate: event.target.value })}
                />
              </label>
            </div>
            <p className="field-note">
              ค่าคอมรวม {money.format((Number(editForm.commissionTons) || 0) * (Number(editForm.commissionRate) || 0))}
            </p>
            <div className="field-grid-2">
              <div className="field">
                <span className="field-label">ยอดรวม (บาท)</span>
                <div className="form-total-display">{money.format(editTotal)}</div>
              </div>
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
            {editError ? <p className="form-error">{editError}</p> : null}
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
                  { key: "review", label: "⚠ รอตรวจสอบ" },
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
              {statusTab === "review" && tabStats.stats.review.count > 0 ? (
                <div className="review-guide">
                  <div className="review-guide__head">
                    <strong>📋 คู่มือการตรวจสอบใบแจ้งหนี้ที่ย้ายมาจากรายการขาย</strong>
                    <span className="cell-sub">เหลือ {tabStats.stats.review.count} ใบที่ต้องตรวจ</span>
                  </div>
                  <ol className="review-guide__list">
                    <li>
                      <strong>กดปุ่ม ✎ แก้ไข</strong> ที่ใบที่มีไอคอน <span className="review-badge">⚠</span>
                    </li>
                    <li>
                      อ่าน <strong>banner สีส้มด้านบนฟอร์ม</strong> — บอกว่าใบนี้ขาดข้อมูลอะไร เช่น
                      <ul>
                        <li><em>เลขที่ใบแจ้งหนี้จริง</em> — ปัจจุบันใช้ placeholder <code>SR-xx</code> ให้ค้นเล่ม/เลขที่จริงจากเอกสารแล้วแก้ในช่อง “เล่มที่” + “เลขที่”</li>
                        <li><em>พนักงานขาย</em> — ปัจจุบันเป็น <code>ไม่ระบุ</code> ให้เลือกเซลส์ที่ถูกต้อง</li>
                        <li><em>commissionRate / commissionTons</em> — ดูในหน้า คอมมิชชั่น (จะเพิ่มทีหลัง) หรือกรอก 0 ถ้าไม่จ่ายคอม</li>
                        <li><em>ข้อมูลสินค้า</em> — ใส่ ชื่อสินค้า, จำนวน, หน่วย, ราคา/หน่วย</li>
                      </ul>
                    </li>
                    <li>
                      <strong>กรอกข้อมูลให้ครบ</strong> แล้วกด <em>“บันทึกการแก้ไข”</em>
                    </li>
                    <li>
                      ตรวจซ้ำว่าถูกต้อง → กดปุ่ม <strong>“ทำเครื่องหมายตรวจแล้ว”</strong> ใน banner สีส้ม → ไอคอน ⚠ จะหายไป และใบจะออกจากแท็บนี้
                    </li>
                    <li>
                      ถ้าใบไหน <strong>ซ้ำกับใบเดิม</strong> (banner จะระบุเลขใบที่อาจซ้ำ) ให้
                      <ul>
                        <li>คัดลอกข้อมูลที่ต้องการเก็บไปไว้ในใบจริง</li>
                        <li>กดปุ่ม 🗑 ลบใบ <code>SR-xx</code> ที่ซ้ำทิ้ง</li>
                      </ul>
                    </li>
                  </ol>
                  <p className="review-guide__tip">
                    💡 <strong>เคล็ดลับ:</strong> เรียงลำดับงานตามวันที่ขาย (เก่าสุด → ใหม่สุด) เพื่อหาเลขเล่มจากแฟ้มเอกสารได้ง่าย —
                    หรือกรองด้วยชื่อลูกค้า/ยอดเงินเพื่อจับคู่กับใบแจ้งหนี้ตัวจริง
                  </p>
                </div>
              ) : null}
              <div className="table-wrap">
              <table className="table invoices-table">
                <colgroup>
                  <col className="col-book" />
                  <col className="col-doc" />
                  <col className="col-due" />
                  <col className="col-customer" />
                  <col className="col-item" />
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
                    <th>สินค้า / จำนวน</th>
                    <th>ผู้รับคอมฯ</th>
                    <th className="num">ยอดรวม</th>
                    <th>สถานะ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map((invoice) => (
                    <tr key={invoice.id} className={invoice.needsReview ? "row-needs-review" : undefined}>
                      {(() => {
                        const parts = parseInvoiceNumber(invoice.invoiceNumber);
                        return (
                          <>
                            <td>
                              <div className="cell-with-badge">
                                <strong className="cell-strong">{parts.book || (invoice.needsReview ? "-" : "-")}</strong>
                                {invoice.needsReview ? (
                                  <span className="review-badge" title={invoice.reviewNotes ?? "รอตรวจสอบ"}>⚠</span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              <strong className="cell-strong">{parts.doc || invoice.invoiceNumber}</strong>
                            </td>
                          </>
                        );
                      })()}
                      <td className="col-due-cell">
                        {invoice.dueDate ? (
                          <span className="cell-strong">{formatThaiDate(invoice.dueDate)}</span>
                        ) : (
                          <span className="cell-sub">ไม่ระบุ</span>
                        )}
                      </td>
                      <td>
                        <strong className="cell-strong">{invoice.customer.name}</strong>
                      </td>
                      <td>
                        {invoice.items && invoice.items.length > 0 ? (
                          <ul className="item-cell-list">
                            {invoice.items.map((item) => (
                              <li key={item.id}>
                                <span className="cell-strong">{item.itemName}</span>
                                <span className="cell-sub">
                                  {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="cell-sub">ไม่ระบุ</span>
                        )}
                      </td>
                      <td>
                        <span className="cell-strong">{invoice.salesperson.name}</span>
                      </td>
                      <td className="num">{money.format(invoice.total)}</td>
                      <td>
                        {(() => {
                          const normalizedStatus = normalizeStatus(invoice.status);

                          return (
                            <div className="status-cell">
                              <span className={statusBadgeClass(invoice.status)}>{normalizedStatus}</span>
                              {normalizedStatus === "รอชำระ" && receivingPaymentId !== invoice.id ? (
                                <button type="button" className="receive-link" onClick={() => setReceivingPaymentId(invoice.id)}>
                                  + บันทึกการรับชำระ
                                </button>
                              ) : null}
                              {normalizedStatus === "ชำระแล้ว" && invoice.paidAt ? (
                                <>
                                  <span className="cell-sub">ชำระ {formatThaiDate(invoice.paidAt)}</span>
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
                          );
                        })()}
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
