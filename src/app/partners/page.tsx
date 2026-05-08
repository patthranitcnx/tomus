"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type Purchase = {
  id: number;
  supplier: string | null;
  address: string | null;
  purchaseDate: string;
};

const REFRESH_MS = 10000;

export default function PartnersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/purchases", { cache: "no-store" }),
      ]);
      const cData = await cRes.json();
      const pData = await pRes.json();
      setCustomers(Array.isArray(cData) ? cData : []);
      setPurchases(Array.isArray(pData) ? pData : []);
      setLastSync(new Date());
      setError(null);
    } catch {
      setError("ไม่สามารถซิงก์ข้อมูลจากเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAll]);

  const existingNames = useMemo(
    () => new Set(customers.map((c) => c.name.trim().toLowerCase())),
    [customers],
  );

  const supplierMap = useMemo(() => {
    const map = new Map<string, { name: string; address: string | null; count: number }>();
    purchases.forEach((p) => {
      if (!p.supplier) return;
      const key = p.supplier.trim().toLowerCase();
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.address && p.address) existing.address = p.address;
      } else {
        map.set(key, { name: p.supplier.trim(), address: p.address, count: 1 });
      }
    });
    return map;
  }, [purchases]);

  const pendingSuppliers = useMemo(
    () =>
      Array.from(supplierMap.values()).filter(
        (s) => !existingNames.has(s.name.toLowerCase()),
      ),
    [supplierMap, existingNames],
  );

  const filteredPartners = useMemo(() => {
    const k = search.trim().toLowerCase();
    if (!k) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.email, c.address]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(k)),
    );
  }, [customers, search]);

  const createPartners = async () => {
    setCreating(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/purchases/create-customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`สร้างคู่ค้าใหม่ ${data.count} รายสำเร็จ`);
        await fetchAll();
      } else {
        setError(data.error || "ไม่สามารถสร้างคู่ค้าได้");
      }
    } catch {
      setError("ไม่สามารถสร้างคู่ค้าได้");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">คู่ค้า</p>
          <h1>สร้างคู่ค้า</h1>
        </div>
        <article className="mini-total">
          <span>คู่ค้าทั้งหมด</span>
          <strong>{customers.length} ราย</strong>
        </article>
      </header>

      <section className="workspace-grid">
        <div className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">รอสร้างจากผู้ขาย</p>
              <h2>ผู้ขายที่ยังไม่ใช่คู่ค้า ({pendingSuppliers.length})</h2>
            </div>
            <button
              type="button"
              onClick={createPartners}
              disabled={creating || pendingSuppliers.length === 0}
            >
              {creating ? "กำลังสร้าง..." : "สร้างคู่ค้าทั้งหมด"}
            </button>
          </div>

          {message && <p className="muted" style={{ color: "var(--success, #059669)" }}>{message}</p>}
          {error && <p className="muted" style={{ color: "#dc2626" }}>{error}</p>}

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : pendingSuppliers.length === 0 ? (
            <p className="muted">ผู้ขายทั้งหมดถูกบันทึกเป็นคู่ค้าแล้ว</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อผู้ขาย</th>
                    <th>ที่อยู่</th>
                    <th>จำนวนบิล</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSuppliers.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td>
                      <td>{s.address || "-"}</td>
                      <td>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>
            {lastSync
              ? `ซิงก์ล่าสุด: ${lastSync.toLocaleTimeString("th-TH")} (อัปเดตอัตโนมัติทุก ${REFRESH_MS / 1000} วินาที)`
              : "กำลังเชื่อมต่อ..."}
          </p>
        </div>

        <div className="content-stack">
          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">คู่ค้าทั้งหมด</p>
                <h2>รายชื่อคู่ค้า</h2>
              </div>
              <input
                type="search"
                placeholder="ค้นหาคู่ค้า..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </div>

            {loading ? (
              <p className="muted">กำลังโหลดข้อมูล...</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>โทรศัพท์</th>
                      <th>ที่อยู่</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPartners.length === 0 ? (
                      <tr>
                        <td colSpan={3}>ยังไม่มีคู่ค้า</td>
                      </tr>
                    ) : (
                      filteredPartners.map((c) => (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{c.phone || "-"}</td>
                          <td>{c.address || "-"}</td>
                        </tr>
                      ))
                    )}
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
