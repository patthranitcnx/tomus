"use client";

import { useEffect, useMemo, useState } from "react";

const MATCH_THRESHOLD = 7;

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
  saleDate: string | null;
  needsReview: boolean;
  customer: { id: number; name: string };
  salesperson: { id: number; name: string };
  items: InvoiceItem[];
};

type SaleRecord = {
  id: number;
  itemName: string;
  customer: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  saleDate: string;
};

const fmtBaht = (n: number) =>
  `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (s: string | null) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "-";
  }
};

const normName = (s: string | null | undefined) => {
  let v = (s ?? "").trim().toLowerCase();
  for (const p of ["ร้าน", "หจก.", "หจก", "บริษัท", "จำกัด", "สวน", "(", ")", "."]) {
    v = v.split(p).join(" ");
  }
  return v.replace(/\s+/g, " ").trim();
};

const nameSim = (a: string | null | undefined, b: string | null | undefined) => {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let inter = 0;
  ta.forEach((t) => { if (tb.has(t)) inter += 1; });
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
};

const scorePair = (inv: Invoice, rec: SaleRecord) => {
  const cs = nameSim(inv.customer?.name, rec.customer);
  const ts = Math.abs(inv.total - rec.total) < 0.01 ? 1 : 0;
  let ds = 0;
  if (inv.saleDate && rec.saleDate) {
    const di = new Date(inv.saleDate).getTime();
    const dr = new Date(rec.saleDate).getTime();
    const days = Math.abs((di - dr) / 86400000);
    if (days <= 1) ds = 1;
    else if (days <= 7) ds = 0.7;
    else if (days <= 30) ds = 0.4;
  }
  return cs * 3 + ts * 4 + ds * 2;
};

type Suggestion = { record: SaleRecord; score: number } | null;

export default function ReconcilePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, number | "">>({}); // invoiceId -> recordId or "" (skip)
  const [filter, setFilter] = useState<"manual" | "matched" | "unmatched">("matched");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [iRes, rRes] = await Promise.all([fetch("/api/invoices"), fetch("/api/sale-records")]);
      const [iData, rData] = await Promise.all([iRes.json(), rRes.json()]);
      setInvoices(Array.isArray(iData) ? iData : []);
      setRecords(Array.isArray(rData) ? rData : []);
    } catch (err) {
      setMessage("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const manualPendingInvoices = useMemo(
    () => invoices.filter((i) => i.needsReview && !i.invoiceNumber.startsWith("SR-")),
    [invoices],
  );

  const suggestions = useMemo<Map<number, Suggestion>>(() => {
    const result = new Map<number, Suggestion>();
    if (records.length === 0) return result;

    type P = { score: number; invId: number; recId: number };
    const pairs: P[] = [];
    for (const inv of manualPendingInvoices) {
      for (const rec of records) {
        const s = scorePair(inv, rec);
        if (s >= 5) pairs.push({ score: s, invId: inv.id, recId: rec.id });
      }
    }
    pairs.sort((a, b) => b.score - a.score);

    const usedRecs = new Set<number>();
    const recById = new Map(records.map((r) => [r.id, r]));
    for (const p of pairs) {
      if (result.has(p.invId)) continue;
      if (usedRecs.has(p.recId)) continue;
      const rec = recById.get(p.recId);
      if (!rec) continue;
      result.set(p.invId, { record: rec, score: p.score });
      usedRecs.add(p.recId);
    }

    for (const inv of manualPendingInvoices) {
      if (!result.has(inv.id)) result.set(inv.id, null);
    }
    return result;
  }, [manualPendingInvoices, records]);

  const srLookup = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const visibleInvoices = useMemo(() => {
    return manualPendingInvoices.filter((inv) => {
      const suggestion = suggestions.get(inv.id);
      const isHighConfidence = Boolean(suggestion && suggestion.score >= MATCH_THRESHOLD);
      if (filter === "matched") return isHighConfidence;
      if (filter === "unmatched") return !isHighConfidence;
      return true;
    });
  }, [manualPendingInvoices, suggestions, filter]);

  const getCurrentMatch = (inv: Invoice): SaleRecord | null => {
    const ovr = overrides[inv.id];
    if (ovr === "") return null;
    if (typeof ovr === "number") return srLookup.get(ovr) ?? null;
    const sug = suggestions.get(inv.id);
    return sug && sug.score >= MATCH_THRESHOLD ? sug.record : null;
  };

  const confirmMatch = async (inv: Invoice) => {
    const match = getCurrentMatch(inv);
    setBusyId(inv.id);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        needsReview: false,
      };
      // If matched, also update items to match the sale-record's product
      if (match) {
        payload.items = [
          {
            itemName: match.itemName,
            quantity: match.quantity,
            unit: match.unit ?? "",
            unitPrice: match.unitPrice,
          },
        ];
      }
      const res = await fetch(`/api/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "ยืนยันไม่สำเร็จ");
      }
      setMessage(`✓ ยืนยันใบ ${inv.invoiceNumber} แล้ว`);
      await refresh();
    } catch (err) {
      setMessage(`ยืนยันไม่สำเร็จ: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusyId(null);
    }
  };

  const skip = (invId: number) => {
    setOverrides((prev) => ({ ...prev, [invId]: "" }));
  };

  const setOverride = (invId: number, recId: number | "") => {
    setOverrides((prev) => ({ ...prev, [invId]: recId }));
  };

  const stats = useMemo(() => {
    const all = invoices.length;
    const reviewed = invoices.filter((i) => !i.needsReview).length;
    const pending = all - reviewed;
    const manualPending = manualPendingInvoices.length;
    const matchedHigh = manualPendingInvoices.filter((inv) => {
      const suggestion = suggestions.get(inv.id);
      return Boolean(suggestion && suggestion.score >= MATCH_THRESHOLD);
    }).length;
    const needsInvoiceFix = manualPending - matchedHigh;
    return { all, reviewed, pending, manualPending, matchedHigh, needsInvoiceFix };
  }, [invoices, manualPendingInvoices, suggestions]);

  return (
    <main className="page">
      <div className="page-header">
        <h1>กระทบยอดใบแจ้งหนี้</h1>
        <p>แสดงเฉพาะใบที่กรอกเองและยังรอตรวจสอบ: ยืนยันเฉพาะคู่ที่ความมั่นใจสูงก่อน ที่เหลือไปแก้ในหน้าใบแจ้งหนี้</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">ทั้งหมด</div>
          <div className="stat-value">{stats.all} ใบ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ยืนยันแล้ว</div>
          <div className="stat-value">{stats.reviewed} ใบ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">รอยืนยัน</div>
          <div className="stat-value">{stats.pending} ใบ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ใบที่กรอกเอง (รอยืนยัน)</div>
          <div className="stat-value">{stats.manualPending} ใบ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">พบจับคู่ได้ (มั่นใจสูง)</div>
          <div className="stat-value">{stats.matchedHigh} ใบ</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">ต้องกลับไปแก้ในใบแจ้งหนี้</div>
          <div className="stat-value">{stats.needsInvoiceFix} ใบ</div>
        </div>
      </div>

      <div className="filter-bar" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", flexWrap: "wrap" }}>
        {([
          ["matched", "พบจับคู่ได้ (มั่นใจสูง)"],
          ["unmatched", "ไม่แน่ใจ/ไม่พบ (ไปแก้ใบแจ้งหนี้)"],
          ["manual", "ใบกรอกเอง รอยืนยันทั้งหมด"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={filter === k ? "btn btn-primary" : "btn btn-ghost"}
            onClick={() => setFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <div className="review-banner" style={{ marginBottom: "1rem" }}>
          <p>{message}</p>
        </div>
      )}

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : visibleInvoices.length === 0 ? (
        <p>ไม่มีรายการในกลุ่มนี้</p>
      ) : (
        <div className="reconcile-list">
          {visibleInvoices.map((inv) => {
            const currentMatch = getCurrentMatch(inv);
            const sug = suggestions.get(inv.id);
            const highConfidence = Boolean(sug && sug.score >= MATCH_THRESHOLD);
            return (
              <article key={inv.id} className="reconcile-card">
                <header className="reconcile-card__head">
                  <div>
                    <strong>{inv.invoiceNumber}</strong>
                    <span className="muted" style={{ marginLeft: "0.5rem" }}>
                      (กรอกเอง)
                    </span>
                  </div>
                  <div className="muted">{fmtDate(inv.saleDate)}</div>
                </header>

                <div className="reconcile-grid">
                  <section className="reconcile-col">
                    <h4>ข้อมูลใบแจ้งหนี้</h4>
                    <dl>
                      <div><dt>ลูกค้า</dt><dd>{inv.customer?.name ?? "-"}</dd></div>
                      <div><dt>เซลส์</dt><dd>{inv.salesperson?.name ?? "-"}</dd></div>
                      <div><dt>สินค้า</dt><dd>
                        {inv.items.length === 0 ? "ไม่ระบุ" : (
                          <ul style={{ paddingLeft: "1rem", margin: 0 }}>
                            {inv.items.map((it) => (
                              <li key={it.id}>{it.itemName} · {it.quantity} {it.unit ?? ""} × {fmtBaht(it.unitPrice)}</li>
                            ))}
                          </ul>
                        )}
                      </dd></div>
                      <div><dt>ยอดรวม</dt><dd><strong>{fmtBaht(inv.total)}</strong></dd></div>
                    </dl>
                  </section>

                  <section className="reconcile-col">
                    <h4>
                      รายการขายที่จับคู่
                      {sug && (
                        <span className="muted" style={{ fontSize: "0.85em", marginLeft: "0.5rem" }}>
                          ความเชื่อมั่น {sug.score.toFixed(1)}/9 {highConfidence ? "(สูง)" : "(ต่ำ)"}
                        </span>
                      )}
                    </h4>
                    {currentMatch ? (
                      <dl>
                        <div><dt>ลูกค้า</dt><dd>{currentMatch.customer ?? "-"}</dd></div>
                        <div><dt>สินค้า</dt><dd>{currentMatch.itemName}</dd></div>
                        <div><dt>จำนวน</dt><dd>{currentMatch.quantity} {currentMatch.unit ?? ""}</dd></div>
                        <div><dt>ราคา/หน่วย</dt><dd>{fmtBaht(currentMatch.unitPrice)}</dd></div>
                        <div><dt>ยอดรวม</dt><dd><strong>{fmtBaht(currentMatch.total)}</strong></dd></div>
                        <div><dt>วันที่ขาย</dt><dd>{fmtDate(currentMatch.saleDate)}</dd></div>
                      </dl>
                    ) : (
                      <p className="muted">ยังไม่พบรายการขายที่ตรงกัน</p>
                    )}

                    <details style={{ marginTop: "0.75rem" }}>
                      <summary style={{ cursor: "pointer" }}>เลือก sale-record เอง</summary>
                      <select
                        value={overrides[inv.id] ?? (currentMatch?.id ?? "")}
                        onChange={(e) => {
                          const v = e.target.value;
                          setOverride(inv.id, v === "" ? "" : Number(v));
                        }}
                        style={{ marginTop: "0.5rem", width: "100%" }}
                      >
                        <option value="">— ไม่จับคู่ —</option>
                        {records
                          .slice()
                          .sort((a, b) => (b.saleDate || "").localeCompare(a.saleDate || ""))
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              #{r.id} · {r.customer ?? "-"} · {r.itemName} {r.quantity}{r.unit ?? ""} · {fmtBaht(r.total)} · {fmtDate(r.saleDate)}
                            </option>
                          ))}
                      </select>
                    </details>
                  </section>
                </div>

                <footer className="reconcile-card__foot" style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === inv.id}
                    onClick={() => confirmMatch(inv)}
                  >
                    {busyId === inv.id ? "กำลังบันทึก..." : currentMatch ? "✓ ยืนยันการจับคู่ + อัปเดตสินค้า" : "✓ ยืนยัน (ไปแก้รายละเอียดในใบแจ้งหนี้ภายหลัง)"}
                  </button>
                  {currentMatch && (
                    <button type="button" className="btn btn-ghost" onClick={() => skip(inv.id)} disabled={busyId === inv.id}>
                      ล้างการจับคู่
                    </button>
                  )}
                  {!currentMatch && (
                    <a className="btn btn-ghost" href="/invoices">
                      ไปหน้าใบแจ้งหนี้
                    </a>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
