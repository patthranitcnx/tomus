"use client";

import { useEffect, useMemo, useState } from "react";
import { compareInvoiceNumbers } from "@/lib/invoice-sorting";
import { formatThaiDate } from "@/lib/format-date";

type Customer = { id: number; name: string };
type Salesperson = { id: number; name: string };

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

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFmt = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const monthLabel = (ym: string) => {
  if (!ym) return "ทุกเดือน";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${months[m - 1]} ${y + 543}`;
};

const invoiceMonth = (inv: Invoice): string => {
  const d = inv.dueDate ? new Date(inv.dueDate) : null;
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function CommissionsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [salespeople, setSalespeople] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSales, setFilterSales] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterPaid, setFilterPaid] = useState<"all" | "unpaid" | "paid">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTons, setEditTons] = useState("");
  const [editRate, setEditRate] = useState("");
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    const [invRes, salesRes] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/salespeople"),
    ]);
    const [invData, salesData] = await Promise.all([invRes.json(), salesRes.json()]);
    setInvoices(Array.isArray(invData) ? invData : []);
    setSalespeople(Array.isArray(salesData) ? salesData : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered invoices (only those with a commission row)
  const filtered = useMemo(() => {
    return invoices
      .filter((inv) => inv.commission !== null)
      .filter((inv) => (filterSales ? String(inv.salesperson.id) === filterSales : true))
      .filter((inv) => (filterMonth ? invoiceMonth(inv) === filterMonth : true))
      .filter((inv) => {
        if (filterPaid === "all") return true;
        if (filterPaid === "paid") return inv.commission?.paid === true;
        return inv.commission?.paid === false;
      })
      .sort((a, b) => compareInvoiceNumbers(a.invoiceNumber, b.invoiceNumber) || a.id - b.id);
  }, [invoices, filterSales, filterMonth, filterPaid]);

  // Group by salesperson
  const grouped = useMemo(() => {
    const map = new Map<number, { sales: Salesperson; rows: Invoice[] }>();
    for (const inv of filtered) {
      const key = inv.salesperson.id;
      if (!map.has(key)) map.set(key, { sales: inv.salesperson, rows: [] });
      map.get(key)!.rows.push(inv);
    }
    return Array.from(map.values()).sort((a, b) => a.sales.name.localeCompare(b.sales.name, "th"));
  }, [filtered]);

  const totals = useMemo(() => {
    let total = 0;
    let paid = 0;
    let unpaid = 0;
    for (const inv of filtered) {
      const amt = inv.commission?.amount ?? 0;
      total += amt;
      if (inv.commission?.paid) paid += amt;
      else unpaid += amt;
    }
    return { total, paid, unpaid };
  }, [filtered]);

  // Months available in the data for the filter dropdown
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const inv of invoices) {
      const m = invoiceMonth(inv);
      if (m) set.add(m);
    }
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditTons(String(inv.commissionTons));
    setEditRate(String(inv.commissionRate));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTons("");
    setEditRate("");
  };

  const saveEdit = async (id: number) => {
    setBusy(true);
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        commissionTons: Number(editTons) || 0,
        commissionRate: Number(editRate) || 0,
      }),
    });
    if (res.ok) {
      cancelEdit();
      await fetchData();
    }
    setBusy(false);
  };

  const togglePaid = async (commissionId: number, paid: boolean) => {
    setBusy(true);
    await fetch(`/api/commissions/${commissionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid }),
    });
    await fetchData();
    setBusy(false);
  };

  const markGroupPaid = async (group: { sales: Salesperson; rows: Invoice[] }, paid: boolean) => {
    setBusy(true);
    const targets = group.rows.filter((r) => r.commission && r.commission.paid !== paid);
    await Promise.all(
      targets.map((r) =>
        fetch(`/api/commissions/${r.commission!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid }),
        }),
      ),
    );
    await fetchData();
    setBusy(false);
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">คอมมิชชั่น</p>
          <h1>บริหารค่าคอมมิชชั่นเซลส์</h1>
        </div>
        <div className="commission-summary">
          <article className="mini-total">
            <span>ยอดคอมรวม</span>
            <strong>{money.format(totals.total)}</strong>
          </article>
          <article className="mini-total mini-total--ok">
            <span>จ่ายแล้ว</span>
            <strong>{money.format(totals.paid)}</strong>
          </article>
          <article className="mini-total mini-total--warn">
            <span>ค้างจ่าย</span>
            <strong>{money.format(totals.unpaid)}</strong>
          </article>
        </div>
      </header>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">ตัวกรอง</p>
            <h2>เลือกเซลส์ / เดือน / สถานะ</h2>
          </div>
        </div>
        <div className="commission-filter">
          <label className="field">
            <span className="field-label">เซลส์</span>
            <select value={filterSales} onChange={(e) => setFilterSales(e.target.value)}>
              <option value="">ทุกคน</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">เดือน (วันครบกำหนด)</span>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
              <option value="">ทุกเดือน</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">สถานะ</span>
            <select value={filterPaid} onChange={(e) => setFilterPaid(e.target.value as "all" | "unpaid" | "paid")}>
              <option value="all">ทั้งหมด</option>
              <option value="unpaid">ค้างจ่าย</option>
              <option value="paid">จ่ายแล้ว</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? (
        <p className="muted">กำลังโหลด...</p>
      ) : grouped.length === 0 ? (
        <section className="panel">
          <p className="muted">ไม่มีข้อมูลคอมมิชชั่นตามตัวกรองนี้</p>
        </section>
      ) : (
        grouped.map((group) => {
          const groupTotal = group.rows.reduce((s, r) => s + (r.commission?.amount ?? 0), 0);
          const groupPaid = group.rows.reduce((s, r) => s + (r.commission?.paid ? r.commission.amount : 0), 0);
          const groupUnpaid = groupTotal - groupPaid;
          const unpaidCount = group.rows.filter((r) => r.commission && !r.commission.paid).length;
          return (
            <section className="panel" key={group.sales.id}>
              <div className="section-header">
                <div>
                  <p className="eyebrow">{group.rows.length} ใบ · ค้างจ่าย {unpaidCount} ใบ</p>
                  <h2>{group.sales.name}</h2>
                </div>
                <div className="commission-group-stats">
                  <span>
                    รวม <strong>{money.format(groupTotal)}</strong>
                  </span>
                  <span className="ok">
                    จ่ายแล้ว <strong>{money.format(groupPaid)}</strong>
                  </span>
                  <span className="warn">
                    ค้าง <strong>{money.format(groupUnpaid)}</strong>
                  </span>
                  {unpaidCount > 0 && (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => markGroupPaid(group, true)}
                    >
                      จ่ายค่าคอมทั้งหมด ({unpaidCount} ใบ)
                    </button>
                  )}
                </div>
              </div>
              <div className="table-wrap">
                <table className="table commission-table">
                  <colgroup>
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "14%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>เลขที่ใบ</th>
                      <th>ลูกค้า</th>
                      <th className="num">จำนวนตัน</th>
                      <th className="num">บาท/ตัน</th>
                      <th className="num">ค่าคอม</th>
                      <th>สถานะการจ่าย</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((inv) => {
                      const editing = editingId === inv.id;
                      return (
                        <tr key={inv.id}>
                          <td>
                            <strong className="cell-strong">{inv.invoiceNumber}</strong>
                            {inv.dueDate && (
                              <span className="cell-sub">
                                ครบ {formatThaiDate(inv.dueDate)}
                              </span>
                            )}
                          </td>
                          <td>{inv.customer.name}</td>
                          <td className="num">
                            {editing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={editTons}
                                onChange={(e) => setEditTons(e.target.value)}
                                className="inline-num"
                              />
                            ) : (
                              `${numberFmt.format(inv.commissionTons)} ตัน`
                            )}
                          </td>
                          <td className="num">
                            {editing ? (
                              <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={editRate}
                                onChange={(e) => setEditRate(e.target.value)}
                                className="inline-num"
                              />
                            ) : (
                              money.format(inv.commissionRate)
                            )}
                          </td>
                          <td className="num">
                            <strong>{money.format(inv.commission?.amount ?? 0)}</strong>
                          </td>
                          <td>
                            {inv.commission ? (
                              <label className="check-row">
                                <input
                                  type="checkbox"
                                  checked={inv.commission.paid}
                                  disabled={busy}
                                  onChange={(e) => togglePaid(inv.commission!.id, e.target.checked)}
                                />
                                <span>
                                  {inv.commission.paid
                                    ? `จ่ายแล้ว${
                                        inv.commission.paidAt
                                          ? " " + formatThaiDate(inv.commission.paidAt)
                                          : ""
                                      }`
                                    : "ยังไม่จ่าย"}
                                </span>
                              </label>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => saveEdit(inv.id)}
                                  >
                                    บันทึก
                                  </button>
                                  <button type="button" className="btn-ghost" onClick={cancelEdit}>
                                    ยกเลิก
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="แก้ไขตัน/อัตรา"
                                  onClick={() => startEdit(inv)}
                                >
                                  ✎
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
