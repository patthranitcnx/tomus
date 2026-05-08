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

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SaleRecordsPage() {
  const [saleRecords, setSaleRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    itemName: "",
    customer: "",
    quantity: "",
    unit: "กระสอบ",
    unitPrice: "",
    saleDate: "",
    note: "",
  });

  const total = useMemo(() => saleRecords.reduce((sum, item) => sum + item.total, 0), [saleRecords]);

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
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice),
      }),
    });

    if (response.ok) {
      setForm({ itemName: "", customer: "", quantity: "", unit: "กระสอบ", unitPrice: "", saleDate: "", note: "" });
      await fetchSaleRecords();
    }

    setSaving(false);
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
          <h2>เพิ่มรายการขาย</h2>
          <input required placeholder="ชื่อสินค้า เช่น ปุ๋ยยูเรีย 46-0-0" value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} />
          <input placeholder="ลูกค้า" value={form.customer} onChange={(event) => setForm({ ...form, customer: event.target.value })} />
          <div className="form-row">
            <input required min="0" step="0.001" type="number" placeholder="จำนวน" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            <input placeholder="หน่วย" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} />
          </div>
          <input required min="0" step="0.001" type="number" placeholder="ราคาขายต่อหน่วย" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} />
          <input type="date" value={form.saleDate} onChange={(event) => setForm({ ...form, saleDate: event.target.value })} />
          <textarea placeholder="หมายเหตุ" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          <button disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกรายการขาย"}</button>
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
                  {saleRecords.map((saleRecord) => (
                    <tr key={saleRecord.id}>
                      <td>{new Date(saleRecord.saleDate).toLocaleDateString("th-TH")}</td>
                      <td>
                        <strong>{saleRecord.itemName}</strong>
                        <span>{saleRecord.customer || saleRecord.note || "-"}</span>
                      </td>
                      <td>{saleRecord.quantity} {saleRecord.unit || ""}</td>
                      <td>{money.format(saleRecord.unitPrice)}</td>
                      <td>{money.format(saleRecord.total)}</td>
                      <td>
                        <button className="btn-danger" onClick={() => deleteSaleRecord(saleRecord.id)}>ลบ</button>
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
