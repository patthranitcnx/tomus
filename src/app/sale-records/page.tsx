"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type SaleRecord = {
  id: number;
  itemName: string;
  customer: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  saleDate: string;
  note: string | null;
};

type SaleItemForm = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

type SaleEditForm = {
  itemName: string;
  customer: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  saleDate: string;
  note: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const createItem = (): SaleItemForm => ({
  id: crypto.randomUUID(),
  itemName: "",
  quantity: "",
  unit: "กระสอบ",
  unitPrice: "",
});

const toDateInputValue = (date: string) => new Date(date).toISOString().slice(0, 10);

export default function SaleRecordsPage() {
  const [saleRecords, setSaleRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SaleEditForm | null>(null);
  const [form, setForm] = useState({
    customer: "",
    saleDate: "",
    note: "",
  });
  const [items, setItems] = useState<SaleItemForm[]>([createItem()]);

  const total = useMemo(() => saleRecords.reduce((sum, item) => sum + item.total, 0), [saleRecords]);
  const sortedSaleRecords = useMemo(
    () =>
      [...saleRecords].sort((a, b) => {
        const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();

        return dateDiff || b.id - a.id;
      }),
    [saleRecords],
  );
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

  const fetchSaleRecords = async () => {
    const response = await fetch("/api/sale-records");
    const data = await response.json();
    setSaleRecords(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSaleRecords();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/sale-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        items: items.map(({ id, ...item }) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      }),
    });

    if (response.ok) {
      setForm({ customer: "", saleDate: "", note: "" });
      setItems([createItem()]);
      await fetchSaleRecords();
    }

    setSaving(false);
  };

  const updateItem = (id: string, values: Partial<SaleItemForm>) => {
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

  const startEdit = (saleRecord: SaleRecord) => {
    setEditingId(saleRecord.id);
    setEditForm({
      itemName: saleRecord.itemName,
      customer: saleRecord.customer || "",
      quantity: String(saleRecord.quantity),
      unit: saleRecord.unit || "",
      unitPrice: String(saleRecord.unitPrice),
      saleDate: toDateInputValue(saleRecord.saleDate),
      note: saleRecord.note || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<SaleEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/sale-records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        quantity: Number(editForm.quantity),
        unitPrice: Number(editForm.unitPrice),
      }),
    });

    if (response.ok) {
      cancelEdit();
      await fetchSaleRecords();
    }

    setUpdating(false);
  };

  const deleteSaleRecord = async (id: number) => {
    await fetch(`/api/sale-records/${id}`, { method: "DELETE" });
    await fetchSaleRecords();
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">รายการขาย</p>
          <h1>บันทึกการขายสินค้า</h1>
        </div>
        <article className="mini-total">
          <span>ยอดขายรวม</span>
          <strong>{money.format(total)}</strong>
        </article>
      </header>

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <div className="section-header">
            <div>
              <p className="eyebrow">วันเดียวหลายรายการ</p>
              <h2>เพิ่มรายการขาย</h2>
            </div>
            <strong>{money.format(formTotal)}</strong>
          </div>
          <input placeholder="ลูกค้า" value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} />
          <input type="date" value={form.saleDate} onChange={(event) => setForm({ ...form, saleDate: event.target.value })} />
          <div className="line-items">
            {items.map((item, index) => (
              <div className="line-item" key={item.id}>
                <div className="line-item-head">
                  <strong>รายการที่ {index + 1}</strong>
                  <button type="button" className="btn-ghost" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                    ลบแถว
                  </button>
                </div>
                <input required placeholder="ชื่อสินค้า เช่น ปุ๋ยยูเรีย 46-0-0" value={item.itemName} onChange={(event) => updateItem(item.id, { itemName: event.target.value })} />
                <div className="form-row">
                  <input required min="0" step="0.001" type="number" placeholder="จำนวน" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />
                  <input placeholder="หน่วย" value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} />
                </div>
                <input required min="0" step="0.001" type="number" placeholder="ราคาขายต่อหน่วย" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} />
                <p className="line-total">
                  รวม {money.format((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                </p>
              </div>
            ))}
          </div>
          <button type="button" className="secondary" onClick={addItem}>
            เพิ่มแถวสินค้า
          </button>
          <textarea placeholder="หมายเหตุ" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : `บันทึก ${items.length} รายการ`}</button>
        </form>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ทั้งหมด {saleRecords.length} รายการ</p>
              <h2>ประวัติการขาย</h2>
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
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>ราคาต่อหน่วย</th>
                    <th>รวม</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSaleRecords.map((saleRecord) => (
                    <tr key={saleRecord.id}>
                      {editingId === saleRecord.id && editForm ? (
                        <>
                          <td>
                            <input
                              className="table-input"
                              type="date"
                              value={editForm.saleDate}
                              onChange={(event) => updateEditForm({ saleDate: event.target.value })}
                            />
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
                                placeholder="ลูกค้า"
                                value={editForm.customer}
                                onChange={(event) => updateEditForm({ customer: event.target.value })}
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
                              <button type="button" disabled={updating} onClick={() => saveEdit(saleRecord.id)}>
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
                          <td>{new Date(saleRecord.saleDate).toLocaleDateString("th-TH")}</td>
                          <td>
                            <strong>{saleRecord.itemName}</strong>
                            <span>{saleRecord.customer || saleRecord.note || "-"}</span>
                          </td>
                          <td>{saleRecord.quantity} {saleRecord.unit || ""}</td>
                          <td>{money.format(saleRecord.unitPrice)}</td>
                          <td>{money.format(saleRecord.total)}</td>
                          <td>
                            <div className="table-actions">
                              <button type="button" className="btn-ghost" onClick={() => startEdit(saleRecord)}>
                                แก้ไข
                              </button>
                              <button type="button" className="btn-danger" onClick={() => deleteSaleRecord(saleRecord.id)}>ลบ</button>
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
