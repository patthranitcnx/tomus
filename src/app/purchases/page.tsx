"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Purchase = {
  id: number;
  itemName: string;
  supplier: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  purchaseDate: string;
  note: string | null;
};

type PurchaseItemForm = {
  id: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const createItem = (): PurchaseItemForm => ({
  id: crypto.randomUUID(),
  itemName: "",
  quantity: "",
  unit: "กระสอบ",
  unitPrice: "",
});

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier: "",
    purchaseDate: "",
    note: "",
  });
  const [items, setItems] = useState<PurchaseItemForm[]>([createItem()]);

  const total = useMemo(() => purchases.reduce((sum, item) => sum + item.total, 0), [purchases]);
  const sortedPurchases = useMemo(
    () =>
      [...purchases].sort((a, b) => {
        const dateDiff = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();

        return dateDiff || a.id - b.id;
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

    return Object.values(summary).sort((a, b) => a.date.getTime() - b.date.getTime());
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/purchases", {
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
      setForm({ supplier: "", purchaseDate: "", note: "" });
      setItems([createItem()]);
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

      <section className="workspace-grid">
        <form className="panel form" onSubmit={handleSubmit}>
          <div className="section-header">
            <div>
              <p className="eyebrow">บิลเดียวหลายรายการ</p>
              <h2>เพิ่มรายการซื้อ</h2>
            </div>
            <strong>{money.format(formTotal)}</strong>
          </div>
          <input placeholder="ผู้ขาย / ซัพพลายเออร์" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} />
          <input type="date" value={form.purchaseDate} onChange={(event) => setForm({ ...form, purchaseDate: event.target.value })} />
          <div className="line-items">
            {items.map((item, index) => (
              <div className="line-item" key={item.id}>
                <div className="line-item-head">
                  <strong>รายการที่ {index + 1}</strong>
                  <button type="button" className="btn-ghost" onClick={() => removeItem(item.id)} disabled={items.length === 1}>
                    ลบแถว
                  </button>
                </div>
                <input required placeholder="ชื่อสินค้า เช่น ปุ๋ยสูตร 15-15-15" value={item.itemName} onChange={(event) => updateItem(item.id, { itemName: event.target.value })} />
                <div className="form-row">
                  <input required min="0" step="0.001" type="number" placeholder="จำนวน" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />
                  <input placeholder="หน่วย" value={item.unit} onChange={(event) => updateItem(item.id, { unit: event.target.value })} />
                </div>
                <input required min="0" step="0.001" type="number" placeholder="ราคาต่อหน่วย" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} />
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

        <div className="content-stack">
          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">สรุปรายวัน</p>
                <h2>ยอดซื้อในแต่ละวัน</h2>
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
            )}
          </section>

          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">ทั้งหมด {purchases.length} รายการ</p>
                <h2>ประวัติการซื้อ</h2>
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
                    {sortedPurchases.map((purchase) => (
                      <tr key={purchase.id}>
                        <td>{new Date(purchase.purchaseDate).toLocaleDateString("th-TH")}</td>
                        <td>
                          <strong>{purchase.itemName}</strong>
                          <span>{purchase.supplier || purchase.note || "-"}</span>
                        </td>
                        <td>{purchase.quantity} {purchase.unit || ""}</td>
                        <td>{money.format(purchase.unitPrice)}</td>
                        <td>{money.format(purchase.total)}</td>
                        <td>
                          <button className="btn-danger" onClick={() => deletePurchase(purchase.id)}>ลบ</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
