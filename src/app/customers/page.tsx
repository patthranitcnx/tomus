"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoices: Array<{ total: number }>;
};

type CustomerEditForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
};

type PurchaseInvoice = {
  id: number;
  invoiceNumber: string;
  total: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  commissionTons: number;
  salesperson: { id: number; name: string } | null;
};

type PurchaseSaleRecord = {
  id: number;
  itemName: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  saleDate: string;
  note: string | null;
};

type CustomerPurchases = {
  customer: { id: number; name: string; phone: string | null; email: string | null; address: string | null };
  invoices: PurchaseInvoice[];
  saleRecords: PurchaseSaleRecord[];
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CustomerEditForm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [purchases, setPurchases] = useState<CustomerPurchases | null>(null);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers");
    const data = await response.json();
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.email, customer.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(keyword)),
    );
  }, [customers, search]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (response.ok) {
      setForm({ name: "", phone: "", email: "", address: "" });
      setAddOpen(false);
      await fetchCustomers();
    }

    setSaving(false);
  };

  const startEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const updateEditForm = (values: Partial<CustomerEditForm>) => {
    setEditForm((currentForm) => (currentForm ? { ...currentForm, ...values } : currentForm));
  };

  const saveEdit = async (id: number) => {
    if (!editForm) {
      return;
    }

    setUpdating(true);

    const response = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    if (response.ok) {
      cancelEdit();
      await fetchCustomers();
    }

    setUpdating(false);
  };

  const deleteCustomer = async (id: number) => {
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await fetchCustomers();
  };

  const openPurchases = async (customer: Customer) => {
    setViewingCustomer(customer);
    setPurchases(null);
    setPurchasesError(null);
    setLoadingPurchases(true);

    try {
      const response = await fetch(`/api/customers/${customer.id}/purchases`);
      const data = await response.json();

      if (response.ok) {
        setPurchases(data);
      } else {
        setPurchasesError(data.error || "ไม่สามารถโหลดรายการซื้อได้");
      }
    } catch {
      setPurchasesError("ไม่สามารถโหลดรายการซื้อได้");
    }

    setLoadingPurchases(false);
  };

  const closePurchases = () => {
    setViewingCustomer(null);
    setPurchases(null);
    setPurchasesError(null);
  };

  useEffect(() => {
    if (!viewingCustomer && !addOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePurchases();
        setAddOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewingCustomer, addOpen]);

  const addCustomerModal = addOpen ? (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          setAddOpen(false);
        }
      }}
    >
      <form className="modal-card" onSubmit={handleSubmit}>
        <div className="section-header">
          <div>
            <p className="eyebrow">ลูกค้า</p>
            <h2>เพิ่มลูกค้าใหม่</h2>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="new-customer-name">ชื่อลูกค้า</label>
          <input
            id="new-customer-name"
            required
            placeholder="ชื่อลูกค้า"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-customer-phone">เบอร์โทร</label>
          <input
            id="new-customer-phone"
            placeholder="เบอร์โทร"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-customer-email">อีเมล</label>
          <input
            id="new-customer-email"
            type="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="new-customer-address">ที่อยู่</label>
          <input
            id="new-customer-address"
            placeholder="ที่อยู่"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>
            ยกเลิก
          </button>
          <button type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกลูกค้า"}</button>
        </div>
      </form>
    </div>
  ) : null;

  const purchasesModal = viewingCustomer ? (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closePurchases();
        }
      }}
    >
      <div className="modal-card modal-card--wide">
        <div className="section-header">
          <div>
            <p className="eyebrow">รายการซื้อของลูกค้า</p>
            <h2>{viewingCustomer.name}</h2>
          </div>
          <button type="button" className="btn-ghost" onClick={closePurchases}>
            ปิด
          </button>
        </div>

        {loadingPurchases ? (
          <p className="muted">กำลังโหลดข้อมูล...</p>
        ) : purchasesError ? (
          <p className="muted" style={{ color: "#dc2626" }}>{purchasesError}</p>
        ) : purchases ? (
          <div className="purchases-modal-body">
            <section>
              <h3 style={{ margin: "0 0 0.5rem" }}>
                ใบแจ้งหนี้ <span className="muted">({purchases.invoices.length})</span>
              </h3>
              {purchases.invoices.length === 0 ? (
                <p className="muted">ยังไม่มีใบแจ้งหนี้</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>เลขที่</th>
                        <th>วันที่</th>
                        <th>ผู้ขาย</th>
                        <th>สถานะ</th>
                        <th style={{ textAlign: "right" }}>ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td>{invoice.invoiceNumber}</td>
                          <td>{new Date(invoice.createdAt).toLocaleDateString("th-TH")}</td>
                          <td>{invoice.salesperson?.name || "-"}</td>
                          <td>{invoice.status}</td>
                          <td style={{ textAlign: "right" }}>{money.format(invoice.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h3 style={{ margin: "0.5rem 0" }}>
                รายการขาย <span className="muted">({purchases.saleRecords.length})</span>
              </h3>
              {purchases.saleRecords.length === 0 ? (
                <p className="muted">ยังไม่มีรายการขาย</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>วันที่</th>
                        <th>สินค้า</th>
                        <th style={{ textAlign: "right" }}>จำนวน</th>
                        <th style={{ textAlign: "right" }}>ราคา/หน่วย</th>
                        <th style={{ textAlign: "right" }}>รวม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchases.saleRecords.map((record) => (
                        <tr key={record.id}>
                          <td>{new Date(record.saleDate).toLocaleDateString("th-TH")}</td>
                          <td>{record.itemName}</td>
                          <td style={{ textAlign: "right" }}>
                            {record.quantity}
                            {record.unit ? ` ${record.unit}` : ""}
                          </td>
                          <td style={{ textAlign: "right" }}>{money.format(record.unitPrice)}</td>
                          <td style={{ textAlign: "right" }}>{money.format(record.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="muted" style={{ textAlign: "right", fontWeight: 600 }}>
              ยอดรวมทั้งหมด:{" "}
              {money.format(
                purchases.invoices.reduce((sum, invoice) => sum + invoice.total, 0) +
                  purchases.saleRecords.reduce((sum, record) => sum + record.total, 0),
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <>
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ลูกค้า</p>
          <h1>จัดการลูกค้า</h1>
        </div>
      </header>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">ทั้งหมด {customers.length} ราย</p>
            <h2>รายชื่อลูกค้า</h2>
            </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            <input
              className="search-input"
              placeholder="ค้นหาลูกค้า"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              className="primary create-toggle"
              onClick={() => setAddOpen(true)}
            >
              + เพิ่มลูกค้า
            </button>
          </div>
        </div>

          {loading ? (
            <p className="muted">กำลังโหลดข้อมูล...</p>
          ) : (
            <>
            {message && <p className="muted" style={{ color: "var(--success, #059669)" }}>{message}</p>}
            {error && <p className="muted" style={{ color: "#dc2626" }}>{error}</p>}
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>ติดต่อ</th>
                    <th>ใบแจ้งหนี้</th>
                    <th>ยอดขาย</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => {
                    const total = customer.invoices.reduce((sum, invoice) => sum + invoice.total, 0);

                    return (
                      <tr key={customer.id}>
                        {editingId === customer.id && editForm ? (
                          <>
                            <td>
                              <div className="table-field-stack">
                                <input
                                  className="table-input"
                                  required
                                  placeholder="ชื่อลูกค้า"
                                  value={editForm.name}
                                  onChange={(event) => updateEditForm({ name: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="ที่อยู่"
                                  value={editForm.address}
                                  onChange={(event) => updateEditForm({ address: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>
                              <div className="table-field-stack">
                                <input
                                  className="table-input"
                                  placeholder="เบอร์โทร"
                                  value={editForm.phone}
                                  onChange={(event) => updateEditForm({ phone: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  type="email"
                                  placeholder="อีเมล"
                                  value={editForm.email}
                                  onChange={(event) => updateEditForm({ email: event.target.value })}
                                />
                              </div>
                            </td>
                            <td>{customer.invoices.length}</td>
                            <td>{money.format(total)}</td>
                            <td>
                              <div className="table-actions">
                                <button type="button" disabled={updating} onClick={() => saveEdit(customer.id)}>
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
                              <strong>{customer.name}</strong>
                              <span>{customer.address || "-"}</span>
                            </td>
                            <td>
                              {customer.phone || "-"}
                              <span>{customer.email || "-"}</span>
                            </td>
                            <td>{customer.invoices.length}</td>
                            <td>{money.format(total)}</td>
                            <td>
                              <div className="table-actions">
                                <button type="button" className="btn-ghost" onClick={() => openPurchases(customer)}>
                                  ดูรายการซื้อ
                                </button>
                                <button type="button" className="btn-ghost" onClick={() => startEdit(customer)}>
                                  แก้ไข
                                </button>
                                <button type="button" className="btn-danger" onClick={() => deleteCustomer(customer.id)}>
                                  ลบ
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
    </div>
    {mounted && purchasesModal ? createPortal(purchasesModal, document.body) : null}
    {mounted && addCustomerModal ? createPortal(addCustomerModal, document.body) : null}
    </>
  );
}
