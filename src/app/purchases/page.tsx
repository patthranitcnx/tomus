"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Purchase = {
  id: number;
  itemName: string;
  supplier: string | null;
  address: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  purchaseDate: string;
  paymentDates: string[];
  paymentAmounts: number[];
  note: string | null;
};

type PurchaseItemForm = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type PaymentEntryForm = {
  date: string;
  amount: string;
};

type PurchaseEditForm = {
  itemName: string;
  supplier: string;
  address: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  purchaseDate: string;
  paymentEntries: PaymentEntryForm[];
  note: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const createItem = (): PurchaseItemForm => ({
  id: crypto.randomUUID(),
  itemName: "",
  quantity: "",
  unit: "กระสอบ",
  unitPrice: "",
});

const toDateInputValue = (date: string | null) => (date ? new Date(date).toISOString().slice(0, 10) : "");
const createPaymentEntry = (): PaymentEntryForm => ({ date: "", amount: "" });
const normalizePaymentEntries = (paymentDates?: string[], paymentAmounts?: number[]) =>
  paymentDates && paymentDates.length > 0
    ? paymentDates.map((date, index) => ({
        date: toDateInputValue(date),
        amount: paymentAmounts?.[index] ? String(paymentAmounts[index]) : "",
      }))
    : [createPaymentEntry()];
const paymentEntryPayload = (paymentEntries: PaymentEntryForm[]) => ({
  paymentDates: paymentEntries.map((entry) => entry.date),
  paymentAmounts: paymentEntries.map((entry) => Number(entry.amount) || 0),
});
const formatPaymentEntries = (paymentDates: string[], paymentAmounts: number[]) =>
  paymentDates
    .filter(Boolean)
    .map((date, index) => {
      const label = new Date(date).toLocaleDateString("th-TH");
      const amount = paymentAmounts[index];

      return Number.isFinite(amount) && amount > 0 ? `${label} (${money.format(amount)})` : label;
    })
    .join(", ");

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [dailySummaryOpen, setDailySummaryOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<PurchaseEditForm | null>(null);
  const [form, setForm] = useState({
    supplier: "",
    address: "",
    purchaseDate: "",
    paymentEntries: [createPaymentEntry()],
    note: "",
  });
  const [items, setItems] = useState<PurchaseItemForm[]>([createItem()]);

  const total = useMemo(() => purchases.reduce((sum, item) => sum + item.total, 0), [purchases]);
  const sortedPurchases = useMemo(
    () =>
      [...purchases].sort((a, b) => {
        const dateDiff = new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime();

        return dateDiff || b.id - a.id;
      }),
    [purchases],
  );
  const dailySummary = useMemo(() => {
    const summary = sortedPurchases.reduce<Record<string, { date: Date; count: number; total: number }>>(
      (result, purchase) => {
        const date = new Date(purchase.purchaseDate);
        const key = date.toISOString().slice(0, 10);

        if (!result[key]) {
          result[key] = { date, count: 0, total: 0 };
        }

        result[key].count += 1;
        result[key].total += purchase.total;

        return result;
      },
      {},
    );

    return Object.values(summary).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sortedPurchases]);
  const formTotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);

        if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
          return sum;
        }

        return sum + quantity * unitPrice;
      }, 0),
    [items],
  );

  const fetchPurchases = async () => {
    const response = await fetch("/api/purchases");
    const data = await response.json();
    setPurchases(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeForm(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [formOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ...paymentEntryPayload(form.paymentEntries),
        items: items.map(({ id, ...item }) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      }),
    });

    if (response.ok) {
      closeForm();
      await fetchPurchases();
    }

    setSaving(false);
  };

  const updateItem = (id: string, values: Partial<PurchaseItemForm>) => {
    setItems((currentItems) =>
      currentItems.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  };

  const addItem = () => {
    setItems((currentItems) => [...currentItems, createItem()]);
  };

  const removeItem = (id: string) => {
    setItems((currentItems) =>
      currentItems.length === 1 ? currentItems : currentItems.filter((item) => item.id !== id),
    );
  };

  const startEdit = (purchase: Purchase) => {
    setEditingId(purchase.id);
    setEditForm({
      itemName: purchase.itemName,
      supplier: purchase.supplier || "",
      address: purchase.address || "",
      quantity: String(purchase.quantity),
      unit: purchase.unit || "",
      unitPrice: String(purchase.unitPrice),
      purchaseDate: toDateInputValue(purchase.purchaseDate),
      paymentEntries: normalizePaymentEntries(purchase.paymentDates, purchase.paymentAmounts),
      note: purchase.note || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<PurchaseEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const updatePaymentEntry = (index: number, values: Partial<PaymentEntryForm>) => {
    setForm((currentForm) => ({
      ...currentForm,
      paymentEntries: currentForm.paymentEntries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...values } : entry,
      ),
    }));
  };

  const addPaymentDate = () => {
    setForm((currentForm) => ({ ...currentForm, paymentEntries: [...currentForm.paymentEntries, createPaymentEntry()] }));
  };

  const removePaymentDate = (index: number) => {
    setForm((currentForm) => ({
      ...currentForm,
      paymentEntries:
        currentForm.paymentEntries.length === 1
          ? [createPaymentEntry()]
          : currentForm.paymentEntries.filter((_, entryIndex) => entryIndex !== index),
    }));
  };

  const updateEditPaymentEntry = (index: number, values: Partial<PaymentEntryForm>) => {
    updateEditForm({
      paymentEntries:
        editForm?.paymentEntries.map((entry, entryIndex) =>
          entryIndex === index ? { ...entry, ...values } : entry,
        ) ?? [createPaymentEntry()],
    });
  };

  const addEditPaymentDate = () => {
    updateEditForm({ paymentEntries: [...(editForm?.paymentEntries ?? [createPaymentEntry()]), createPaymentEntry()] });
  };

  const removeEditPaymentDate = (index: number) => {
    const currentPaymentEntries = editForm?.paymentEntries ?? [createPaymentEntry()];

    updateEditForm({
      paymentEntries:
        currentPaymentEntries.length === 1
          ? [createPaymentEntry()]
          : currentPaymentEntries.filter((_, entryIndex) => entryIndex !== index),
    });
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/purchases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        ...paymentEntryPayload(editForm.paymentEntries),
        quantity: Number(editForm.quantity),
        unitPrice: Number(editForm.unitPrice),
      }),
    });

    if (response.ok) {
      cancelEdit();
      await fetchPurchases();
    }

    setUpdating(false);
  };

  const closeForm = () => {
    setFormOpen(false);
    setForm({ supplier: "", address: "", purchaseDate: "", paymentEntries: [createPaymentEntry()], note: "" });
    setItems([createItem()]);
  };

  const deletePurchase = async (id: number) => {
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    await fetchPurchases();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">รายการซื้อ</p>
          <h1>บันทึกการซื้อสินค้า</h1>
        </div>
        <article className="mini-total">
          <span>ยอดซื้อรวม</span>
          <strong>{money.format(total)}</strong>
        </article>
      </header>

      {/* ── Create purchase modal ── */}
      {formOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div className="modal-card modal-card--wide">
            <div className="section-header">
              <div>
                <p className="eyebrow">บิลเดียวหลายรายการ</p>
                <h2>เพิ่มรายการซื้อ</h2>
              </div>
              <strong className="form-sticky-total">{money.format(formTotal)}</strong>
            </div>
            <form className="form" onSubmit={handleSubmit}>
          {/* ── Section 1: ข้อมูลใบสั่งซื้อ ── */}
          <div className="form-section">
            <p className="form-section-title">ข้อมูลใบสั่งซื้อ</p>
            <div className="form-field">
              <label htmlFor="p-supplier">ผู้ขาย / ซัพพลายเออร์</label>
              <input id="p-supplier" placeholder="ชื่อบริษัท หรือชื่อร้านค้า" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} />
            </div>
            <div className="form-field">
              <label htmlFor="p-address">ที่อยู่</label>
              <input id="p-address" placeholder="ที่อยู่ (ไม่บังคับ)" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </div>
            <div className="form-field">
              <label htmlFor="p-date">วันที่ซื้อ <span className="field-req">*</span></label>
              <input id="p-date" type="date" required value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
            </div>
          </div>

          {/* ── Section 2: การชำระเงิน ── */}
          <div className="form-section">
            <p className="form-section-title">การชำระเงิน</p>
            <div className="payment-entry-labels">
              <span>วันที่ชำระ</span>
              <span>จำนวนเงิน (บาท)</span>
            </div>
            <div className="table-field-stack">
              {form.paymentEntries.map((paymentEntry, index) => (
                <div className="payment-row" key={index}>
                  <input type="date" aria-label={`วันชำระเงิน ${index + 1}`} value={paymentEntry.date} onChange={(event) => updatePaymentEntry(index, { date: event.target.value })} />
                  <input min="0" step="0.01" type="number" placeholder="0.00" aria-label={`จำนวนเงินที่ชำระ ${index + 1}`} value={paymentEntry.amount} onChange={(event) => updatePaymentEntry(index, { amount: event.target.value })} />
                  <button type="button" className="btn-ghost" onClick={() => removePaymentDate(index)} disabled={form.paymentEntries.length === 1}>
                    ลบ
                  </button>
                </div>
              ))}
              <button type="button" className="secondary" onClick={addPaymentDate}>
                + เพิ่มวันชำระเงิน
              </button>
            </div>
          </div>

          {/* ── Section 3: รายการสินค้า ── */}
          <div className="form-section">
            <p className="form-section-title">รายการสินค้า</p>
            <div className="line-items">
              {items.map((item, index) => (
                <div className="line-item" key={item.id}>
                  <div className="line-item-head">
                    <strong>รายการที่ {index + 1}</strong>
                    <button type="button" className="btn-ghost" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                      ลบแถว
                    </button>
                  </div>
                  <div className="form-field">
                    <label>ชื่อสินค้า <span className="field-req">*</span></label>
                    <input required placeholder="เช่น ปุ๋ยสูตร 15-15-15" value={item.itemName} onChange={(event) => updateItem(item.id, { itemName: event.target.value })} />
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>จำนวน <span className="field-req">*</span></label>
                      <input required min="0" step="0.001" type="number" placeholder="0" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />
                    </div>
                    <div className="form-field">
                      <label>หน่วย</label>
                      <input placeholder="กระสอบ" value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} />
                    </div>
                  </div>
                  <div className="form-field">
                    <label>ราคาต่อหน่วย (บาท) <span className="field-req">*</span></label>
                    <input required min="0" step="0.001" type="number" placeholder="0.00" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} />
                  </div>
                  <p className="line-total">
                    รวม {money.format((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                  </p>
                </div>
              ))}
            </div>
            <button type="button" className="secondary" onClick={addItem}>
              + เพิ่มแถวสินค้า
            </button>
            <div className="form-field">
              <label htmlFor="p-note">หมายเหตุ</label>
              <textarea id="p-note" placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </div>
          </div>

          {/* ── Sticky action bar ── */}
              <div className="modal-actions">
                <span className="form-sticky-label">{items.length} รายการ • {money.format(formTotal)}</span>
                <button type="button" className="btn-ghost" onClick={closeForm}>ยกเลิก</button>
                <button type="submit" disabled={saving}>
                  {saving ? "กำลังบันทึก..." : "บันทึกรายการซื้อ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="content-stack">
        <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">ทั้งหมด {purchases.length} รายการ</p>
                <h2>ประวัติการซื้อ</h2>
              </div>
              <button
                type="button"
                className="primary create-toggle"
                onClick={() => setFormOpen(true)}
              >
                + เพิ่มรายการซื้อ
              </button>
            </div>

            {loading ? (
              <p className="muted">กำลังโหลดข้อมูล...</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>วันชำระเงิน</th>
                      <th>สินค้า</th>
                      <th>จำนวน</th>
                      <th>ราคาต่อหน่วย</th>
                      <th>รวม</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        {editingId === purchase.id && editForm ? (
                          <>
                            <td>
                              <input
                                className="table-input"
                                type="date"
                                value={editForm.purchaseDate}
                                onChange={(event) => updateEditForm({ purchaseDate: event.target.value })}
                              />
                            </td>
                            <td>
                              <div className="table-field-stack">
                                {editForm.paymentEntries.map((paymentEntry, index) => (
                                  <div className="payment-row" key={index}>
                                    <input
                                      className="table-input"
                                      type="date"
                                      aria-label={`วันชำระเงิน ${index + 1}`}
                                      value={paymentEntry.date}
                                      onChange={(event) => updateEditPaymentEntry(index, { date: event.target.value })}
                                    />
                                    <input
                                      className="table-input"
                                      min="0"
                                      step="0.01"
                                      type="number"
                                      placeholder="จำนวนเงิน"
                                      aria-label={`จำนวนเงินที่ชำระ ${index + 1}`}
                                      value={paymentEntry.amount}
                                      onChange={(event) => updateEditPaymentEntry(index, { amount: event.target.value })}
                                    />
                                    <button type="button" className="btn-ghost" onClick={() => removeEditPaymentDate(index)} disabled={editForm.paymentEntries.length === 1}>
                                      ลบ
                                    </button>
                                  </div>
                                ))}
                                <button type="button" className="secondary" onClick={addEditPaymentDate}>
                                  เพิ่มวัน
                                </button>
                              </div>
                            </td>
                            <td>
                              <div className="table-field-stack">
                                <input
                                  className="table-input"
                                  required
                                  placeholder="ชื่อสินค้า"
                                  value={editForm.itemName}
                                  onChange={(event) => updateEditForm({ itemName: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="ผู้ขาย / ซัพพลายเออร์"
                                  value={editForm.supplier}
                                  onChange={(event) => updateEditForm({ supplier: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="ที่อยู่"
                                  value={editForm.address}
                                  onChange={(event) => updateEditForm({ address: event.target.value })}
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
                              <div className="table-field-stack table-field-stack--small">
                                <input
                                  className="table-input"
                                  required
                                  min="0"
                                  step="0.001"
                                  type="number"
                                  placeholder="จำนวน"
                                  value={editForm.quantity}
                                  onChange={(event) => updateEditForm({ quantity: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="หน่วย"
                                  value={editForm.unit}
                                  onChange={(event) => updateEditForm({ unit: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <input
                                className="table-input"
                                required
                                min="0"
                                step="0.001"
                                type="number"
                                value={editForm.unitPrice}
                                onChange={(event) => updateEditForm({ unitPrice: event.target.value })}
                              />
                            </td>
                            <td>{money.format((Number(editForm.quantity) || 0) * (Number(editForm.unitPrice) || 0))}</td>
                            <td>
                              <div className="table-actions">
                                <button disabled={updating} onClick={() => saveEdit(purchase.id)}>
                                  {updating ? "บันทึก..." : "บันทึก"}
                                </button>
                                <button className="btn-ghost" onClick={cancelEdit}>
                                  ยกเลิก
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>{new Date(purchase.purchaseDate).toLocaleDateString("th-TH")}</td>
                            <td>
                              {purchase.paymentDates.length > 0 ? (
                                <div className="payment-cell">
                                  <span className="status-badge status-badge--paid">ชำระแล้ว</span>
                                  <span className="cell-sub">{formatPaymentEntries(purchase.paymentDates, purchase.paymentAmounts ?? [])}</span>
                                </div>
                              ) : (
                                <span className="status-badge status-badge--pending">ยังไม่ชำระ</span>
                              )}
                            </td>
                            <td>
                              <strong>{purchase.itemName}</strong>
                              <span>{purchase.supplier || purchase.note || "-"}</span>
                            </td>
                            <td>{purchase.quantity} {purchase.unit || ""}</td>
                            <td>{money.format(purchase.unitPrice)}</td>
                            <td>{money.format(purchase.total)}</td>
                            <td>
                              <div className="table-actions">
                                <button className="btn-ghost" onClick={() => startEdit(purchase)}>
                                  แก้ไข
                                </button>
                                <button className="btn-danger" onClick={() => deletePurchase(purchase.id)}>ลบ</button>
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

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">สรุปรายวัน</p>
              <h2>ยอดซื้อในแต่ละวัน</h2>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => setDailySummaryOpen((current) => !current)}
              aria-expanded={dailySummaryOpen}
              aria-controls="daily-summary-table"
            >
              {dailySummaryOpen ? "ซ่อนสรุป" : "แสดงสรุป"}
            </button>
          </div>

          {dailySummaryOpen ? (
            loading ? (
              <p className="muted">กำลังโหลดข้อมูล...</p>
            ) : (
              <div className="table-wrap" id="daily-summary-table">
                <table className="table daily-summary-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>จำนวนรายการ</th>
                      <th>ยอดซื้อรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.length === 0 ? (
                      <tr>
                        <td colSpan={3}>ยังไม่มีรายการซื้อ</td>
                      </tr>
                    ) : (
                      dailySummary.map((day) => (
                        <tr key={day.date.toISOString()}>
                          <td>{day.date.toLocaleDateString("th-TH")}</td>
                          <td>{day.count}</td>
                          <td>{money.format(day.total)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className="muted">ซ่อนสรุปรายวันไว้ เพื่อลดความยาวของหน้า</p>
          )}
        </section>
        </div>
    </div>
  );
}
