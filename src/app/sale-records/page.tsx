"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatThaiDate } from "@/lib/format-date";

type SaleRecord = {
  id: number;
  itemName: string;
  customer: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  saleDate: string;
  paymentDates: string[];
  paymentAmounts: number[];
  note: string | null;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  address: string;
};

type SaleItemForm = {
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

type SaleEditForm = {
  itemName: string;
  customer: string;
  customerPhone: string;
  customerAddress: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  saleDate: string;
  paymentEntries: PaymentEntryForm[];
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

const toDateInputValue = (date: string | null) => (date ? new Date(date).toISOString().slice(0, 10) : "");
const toDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
const todayDateKey = () => toDateKey(new Date());
const monthDateRange = (date = new Date()) => ({
  start: toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
  end: toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
});
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
const paymentEntriesForDisplay = (paymentDates: string[], paymentAmounts: number[]) =>
  paymentDates
    .filter(Boolean)
    .map((date, index) => ({
      date,
      label: formatThaiDate(date),
      amount: paymentAmounts[index] ?? 0,
    }));

const getPaymentMeta = (saleRecord: SaleRecord) => {
  const entries = paymentEntriesForDisplay(saleRecord.paymentDates, saleRecord.paymentAmounts ?? []);
  const paidAmount = entries.reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0);
  const hasPaymentAmounts = entries.some((entry) => entry.amount > 0);
  const remainingAmount = Math.max(saleRecord.total - paidAmount, 0);
  const status =
    entries.length === 0
      ? "pending"
      : hasPaymentAmounts && paidAmount < saleRecord.total
        ? "partial"
        : "paid";

  return {
    entries,
    hasPaymentAmounts,
    paidAmount,
    remainingAmount,
    status,
    statusLabel: status === "pending" ? "รอชำระ" : status === "partial" ? "จ่ายบางส่วน" : "ชำระครบ",
  };
};

export default function SaleRecordsPage() {
  const [saleRecords, setSaleRecords] = useState<SaleRecord[]>([]);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SaleEditForm | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"create" | "history" | "summary">("create");
  const [dateRange, setDateRange] = useState(() => monthDateRange());
  const [form, setForm] = useState({
    customer: "",
    customerPhone: "",
    customerAddress: "",
    saleDate: "",
    paymentEntries: [createPaymentEntry()],
    note: "",
  });
  const [items, setItems] = useState<SaleItemForm[]>([createItem()]);
  const customerKeyword = form.customer.trim().toLowerCase();

  const total = useMemo(() => saleRecords.reduce((sum, item) => sum + item.total, 0), [saleRecords]);
  const totalPaid = useMemo(() => saleRecords.reduce((sum, item) => sum + getPaymentMeta(item).paidAmount, 0), [saleRecords]);
  const totalRemaining = useMemo(() => saleRecords.reduce((sum, item) => sum + getPaymentMeta(item).remainingAmount, 0), [saleRecords]);
  const customerSuggestions = useMemo(() => {
    if (!customerKeyword) {
      return customerOptions.slice(0, 6);
    }

    return customerOptions
      .filter((customer) =>
        [customer.name, customer.phone, customer.address]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(customerKeyword)),
      )
      .slice(0, 6);
  }, [customerKeyword, customerOptions]);
  const sortedSaleRecords = useMemo(
    () =>
      [...saleRecords].sort((a, b) => {
        const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();

        return dateDiff || b.id - a.id;
      }),
    [saleRecords],
  );
  const dateFilteredSaleRecords = useMemo(
    () =>
      sortedSaleRecords.filter((saleRecord) => {
        const saleDate = toDateInputValue(saleRecord.saleDate);
        const matchesStart = !dateRange.start || saleDate >= dateRange.start;
        const matchesEnd = !dateRange.end || saleDate <= dateRange.end;

        return matchesStart && matchesEnd;
      }),
    [dateRange.end, dateRange.start, sortedSaleRecords],
  );
  const filteredSaleRecords = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return dateFilteredSaleRecords.filter((saleRecord) => {
      const paymentMeta = getPaymentMeta(saleRecord);
      const matchesStatus = paymentFilter === "all" || paymentMeta.status === paymentFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [
          saleRecord.itemName,
          saleRecord.customer,
          saleRecord.customerPhone,
          saleRecord.customerAddress,
          saleRecord.note,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [dateFilteredSaleRecords, paymentFilter, searchTerm]);
  const dailySummary = useMemo(() => {
    const grouped = dateFilteredSaleRecords.reduce<Record<string, { label: string; total: number; count: number }>>((summary, saleRecord) => {
      const date = new Date(saleRecord.saleDate);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      if (!summary[key]) {
        summary[key] = {
          label: date.toLocaleDateString("th-TH", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          total: 0,
          count: 0,
        };
      }

      summary[key].total += saleRecord.total;
      summary[key].count += 1;

      return summary;
    }, {});

    return Object.entries(grouped)
      .map(([date, summary]) => ({ date, ...summary }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [dateFilteredSaleRecords]);
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

  const fetchCustomers = async () => {
    const response = await fetch("/api/customers");
    const data = await response.json();

    if (!Array.isArray(data)) {
      return;
    }

    setCustomerOptions(
      data.map((customer: { id: number; name: string; phone: string | null; address: string | null }) => ({
        id: `customer-${customer.id}`,
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || "",
      })),
    );
  };

  useEffect(() => {
    fetchSaleRecords();
    fetchCustomers();
  }, []);

  useEffect(() => {
    const applyHashTab = () => {
      const hash = window.location.hash.replace("#", "");

      if (hash === "history" || hash === "history-all") {
        setActiveTab("history");
      }

      if (hash === "summary") {
        setActiveTab("summary");
      }

      if (hash === "history-all") {
        setDateRange({ start: "", end: "" });
      }
    };

    applyHashTab();
    window.addEventListener("hashchange", applyHashTab);

    return () => window.removeEventListener("hashchange", applyHashTab);
  }, []);

  useEffect(() => {
    const saleRecordCustomerOptions = saleRecords
      .filter((saleRecord) => saleRecord.customer)
      .map((saleRecord) => ({
        id: `sale-record-${saleRecord.id}`,
        name: saleRecord.customer || "",
        phone: saleRecord.customerPhone || "",
        address: saleRecord.customerAddress || "",
      }));
    const uniqueCustomers = new Map<string, CustomerOption>();

    [...customerOptions, ...saleRecordCustomerOptions].forEach((customer) => {
      const key = customer.name.trim().toLowerCase();

      if (!key) {
        return;
      }

      if (!uniqueCustomers.has(key)) {
        uniqueCustomers.set(key, customer);
        return;
      }

      const existingCustomer = uniqueCustomers.get(key)!;
      uniqueCustomers.set(key, {
        ...existingCustomer,
        phone: existingCustomer.phone || customer.phone,
        address: existingCustomer.address || customer.address,
      });
    });

    if (uniqueCustomers.size !== customerOptions.length) {
      setCustomerOptions(Array.from(uniqueCustomers.values()).sort((a, b) => a.name.localeCompare(b.name, "th")));
    }
  }, [customerOptions, saleRecords]);

  const selectCustomer = (customer: CustomerOption) => {
    setForm((currentForm) => ({
      ...currentForm,
      customer: customer.name,
      customerPhone: customer.phone || currentForm.customerPhone,
      customerAddress: customer.address || currentForm.customerAddress,
    }));
  };

  const updateCustomerName = (name: string) => {
    const exactCustomer = customerOptions.find((customer) => customer.name.toLowerCase() === name.trim().toLowerCase());

    setForm((currentForm) => ({
      ...currentForm,
      customer: name,
      customerPhone: exactCustomer?.phone || currentForm.customerPhone,
      customerAddress: exactCustomer?.address || currentForm.customerAddress,
    }));
  };

  const applyDatePreset = (preset: "today" | "month" | "all") => {
    if (preset === "today") {
      const today = todayDateKey();
      setDateRange({ start: today, end: today });
      return;
    }

    if (preset === "month") {
      const range = monthDateRange();
      setDateRange(range);
      return;
    }

    setDateRange({ start: "", end: "" });
  };

  const switchTab = (tab: "create" | "history" | "summary") => {
    setActiveTab(tab);

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", tab === "create" ? window.location.pathname : `#${tab}`);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const response = await fetch("/api/sale-records", {
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
      setForm({ customer: "", customerPhone: "", customerAddress: "", saleDate: "", paymentEntries: [createPaymentEntry()], note: "" });
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
      customerPhone: saleRecord.customerPhone || "",
      customerAddress: saleRecord.customerAddress || "",
      quantity: String(saleRecord.quantity),
      unit: saleRecord.unit || "",
      unitPrice: String(saleRecord.unitPrice),
      saleDate: toDateInputValue(saleRecord.saleDate),
      paymentEntries: normalizePaymentEntries(saleRecord.paymentDates, saleRecord.paymentAmounts),
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

    const response = await fetch(`/api/sale-records/${id}`, {
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
      await fetchSaleRecords();
    }

    setUpdating(false);
  };

  const deleteSaleRecord = async (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
    }

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
        <div className="mini-total-grid">
          <article className="mini-total">
            <span>ยอดขายรวม</span>
            <strong>{money.format(total)}</strong>
          </article>
          <article className="mini-total">
            <span>ชำระแล้ว</span>
            <strong>{money.format(totalPaid)}</strong>
          </article>
          <article className="mini-total">
            <span>ค้างชำระ</span>
            <strong>{money.format(totalRemaining)}</strong>
          </article>
        </div>
      </header>

      <div className="sale-page-tabs" aria-label="ส่วนงานรายการขาย">
        <button
          type="button"
          className={activeTab === "create" ? "active" : undefined}
          onClick={() => switchTab("create")}
        >
          เพิ่มรายการขาย
        </button>
        <button
          type="button"
          className={activeTab === "history" ? "active" : undefined}
          onClick={() => switchTab("history")}
        >
          ประวัติการขาย
        </button>
      </div>

      {activeTab !== "create" && (
        <section className="date-filter-panel">
          <div className="date-range-bar">
            <div>
              <p className="eyebrow">ช่วงวันที่</p>
              <strong>
                {dateRange.start || "เริ่มต้น"} - {dateRange.end || "ล่าสุด"}
              </strong>
            </div>
            <div className="date-range-actions">
              <button type="button" className="secondary" onClick={() => applyDatePreset("today")}>
                วันนี้
              </button>
              <button type="button" className="secondary" onClick={() => applyDatePreset("month")}>
                เดือนนี้
              </button>
              <button type="button" className="secondary" onClick={() => applyDatePreset("all")}>
                ทั้งหมด
              </button>
            </div>
            <div className="date-range-inputs">
              <input
                type="date"
                aria-label="วันที่เริ่มต้น"
                value={dateRange.start}
                onChange={(event) => setDateRange((currentRange) => ({ ...currentRange, start: event.target.value }))}
              />
              <input
                type="date"
                aria-label="วันที่สิ้นสุด"
                value={dateRange.end}
                onChange={(event) => setDateRange((currentRange) => ({ ...currentRange, end: event.target.value }))}
              />
            </div>
          </div>
        </section>
      )}

      <div className="sale-tab-content">
        {activeTab === "create" && (
        <form className="panel form sale-entry-form" onSubmit={handleSubmit}>
          <div className="section-header">
            <div>
              <p className="eyebrow">วันเดียวหลายรายการ</p>
              <h2>เพิ่มรายการขาย</h2>
            </div>
            <strong>{money.format(formTotal)}</strong>
          </div>
          <div className="customer-autocomplete">
            <input
              placeholder="ลูกค้า"
              value={form.customer}
              onChange={(event) => updateCustomerName(event.target.value)}
              list="sale-customer-options"
            />
            <datalist id="sale-customer-options">
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.name} />
              ))}
            </datalist>
            {customerSuggestions.length > 0 && form.customer && (
              <div className="customer-suggestions">
                {customerSuggestions.map((customer) => (
                  <button type="button" key={customer.id} onClick={() => selectCustomer(customer)}>
                    <strong>{customer.name}</strong>
                    {(customer.phone || customer.address) && (
                      <span>{[customer.phone, customer.address].filter(Boolean).join(" · ")}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input placeholder="เบอร์โทรลูกค้า" value={form.customerPhone} onChange={(event) => setForm({ ...form, customerPhone: event.target.value })} />
          <input placeholder="ที่อยู่ลูกค้า" value={form.customerAddress} onChange={(event) => setForm({ ...form, customerAddress: event.target.value })} />
          <input type="date" value={form.saleDate} onChange={(event) => setForm({ ...form, saleDate: event.target.value })} />
          <div className="table-field-stack">
            {form.paymentEntries.map((paymentEntry, index) => (
              <div className="payment-row" key={index}>
                <input type="date" aria-label={`วันชำระเงิน ${index + 1}`} value={paymentEntry.date} onChange={(event) => updatePaymentEntry(index, { date: event.target.value })} />
                <input min="0" step="0.01" type="number" placeholder="จำนวนเงิน" aria-label={`จำนวนเงินที่ชำระ ${index + 1}`} value={paymentEntry.amount} onChange={(event) => updatePaymentEntry(index, { amount: event.target.value })} />
                <button type="button" className="btn-ghost" onClick={() => removePaymentDate(index)} disabled={form.paymentEntries.length === 1}>
                  ลบ
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addPaymentDate}>
              เพิ่มวันชำระเงิน
            </button>
          </div>
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
        )}

        {activeTab === "summary" && (
          <section className="panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">สรุปรายวัน</p>
                <h2>ยอดขายในแต่ละวัน</h2>
              </div>
            </div>

            {loading ? (
              <p className="muted">กำลังโหลดข้อมูล...</p>
            ) : (
              <div className="table-wrap">
                <table className="table daily-summary-table">
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>จำนวนรายการ</th>
                      <th>ยอดขายรวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailySummary.length === 0 ? (
                      <tr>
                        <td colSpan={3}>ยังไม่มีรายการขาย</td>
                      </tr>
                    ) : (
                      dailySummary.map((day) => (
                        <tr key={day.date}>
                          <td>{day.label}</td>
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
        )}

        {activeTab === "history" && (
          <section className="panel sales-history-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">ทั้งหมด {saleRecords.length} รายการ</p>
                <h2>ประวัติการขาย</h2>
              </div>
              <div className="history-toolbar">
                <input
                  className="search-input"
                  placeholder="ค้นหาลูกค้า / สินค้า"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <select
                  className="inline-select"
                  value={paymentFilter}
                  onChange={(event) => setPaymentFilter(event.target.value)}
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="pending">รอชำระ</option>
                  <option value="partial">จ่ายบางส่วน</option>
                  <option value="paid">ชำระครบ</option>
                </select>
              </div>
            </div>

            {loading ? (
              <p className="muted">กำลังโหลดข้อมูล...</p>
            ) : filteredSaleRecords.length === 0 ? (
              <p className="muted">ยังไม่มีรายการขาย</p>
            ) : (
              <div className="sale-record-list">
                {filteredSaleRecords.map((saleRecord) => {
                  const paymentMeta = getPaymentMeta(saleRecord);
                  const isExpanded = selectedId === saleRecord.id;

                  return (
                    <article className={`sale-record-card ${isExpanded ? "is-expanded" : ""}`} key={saleRecord.id}>
                      <button type="button" className="sale-record-summary" onClick={() => setSelectedId(isExpanded ? null : saleRecord.id)}>
                        <span className="sale-record-date">{formatThaiDate(saleRecord.saleDate)}</span>
                        <span className="sale-record-main">
                          <strong>{saleRecord.customer || "-"}</strong>
                          <span>{saleRecord.itemName}</span>
                        </span>
                        <span className="sale-record-amount">
                          <strong>{money.format(saleRecord.total)}</strong>
                          <span>{saleRecord.quantity} {saleRecord.unit || ""}</span>
                        </span>
                        <span className="sale-record-payment">
                          <span className={`payment-status payment-status--${paymentMeta.status}`}>
                            {paymentMeta.statusLabel}
                          </span>
                          <small>{paymentMeta.entries.length > 0 ? `${paymentMeta.entries.length} งวด` : "ไม่มีวันชำระ"}</small>
                          {paymentMeta.hasPaymentAmounts && <small>{money.format(paymentMeta.paidAmount)}</small>}
                        </span>
                        <span className="sale-record-toggle">{isExpanded ? "ซ่อน" : "รายละเอียด"}</span>
                      </button>

                      {isExpanded && (
                        <div className="sale-record-detail">
                          <div className="detail-metrics">
                            <article>
                              <span>ยอดขาย</span>
                              <strong>{money.format(saleRecord.total)}</strong>
                            </article>
                            <article>
                              <span>ชำระแล้ว</span>
                              <strong>{money.format(paymentMeta.paidAmount)}</strong>
                            </article>
                            <article>
                              <span>ค้างชำระ</span>
                              <strong>{money.format(paymentMeta.remainingAmount)}</strong>
                            </article>
                          </div>

                          <div className="detail-grid">
                            <div className="detail-block">
                              <span>สินค้า</span>
                              <strong>{saleRecord.itemName}</strong>
                              <p>{saleRecord.quantity} {saleRecord.unit || ""} x {money.format(saleRecord.unitPrice)}</p>
                            </div>

                            {(saleRecord.customerPhone || saleRecord.customerAddress || saleRecord.note) && (
                              <div className="detail-block">
                                <span>ข้อมูลเพิ่มเติม</span>
                                {saleRecord.customerPhone && <p>{saleRecord.customerPhone}</p>}
                                {saleRecord.customerAddress && <p>{saleRecord.customerAddress}</p>}
                                {saleRecord.note && <p>{saleRecord.note}</p>}
                              </div>
                            )}

                            <div className="detail-block">
                              <div className="detail-block-header">
                                <span>งวดชำระเงิน</span>
                                <strong>{paymentMeta.entries.length} งวด</strong>
                              </div>
                              {paymentMeta.entries.length > 0 ? (
                                <div className="payment-timeline">
                                  {paymentMeta.entries.map((entry, index) => (
                                    <div className="payment-timeline-item" key={`${saleRecord.id}-${entry.date}-${index}`}>
                                      <span>{entry.label}</span>
                                      <strong>{entry.amount > 0 ? money.format(entry.amount) : "ไม่ระบุยอด"}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="muted">ยังไม่มีข้อมูลการชำระเงิน</p>
                              )}
                            </div>
                          </div>

                          {editingId === saleRecord.id && editForm ? (
                            <div className="detail-edit-form">
                              <div className="form-row">
                                <input
                                  className="table-input"
                                  type="date"
                                  value={editForm.saleDate}
                                  onChange={(event) => updateEditForm({ saleDate: event.target.value })}
                                />
                                <input
                                  className="table-input"
                                  placeholder="ลูกค้า"
                                  value={editForm.customer}
                                  onChange={(event) => updateEditForm({ customer: event.target.value })}
                                />
                              </div>
                              <input
                                className="table-input"
                                required
                                placeholder="ชื่อสินค้า"
                                value={editForm.itemName}
                                onChange={(event) => updateEditForm({ itemName: event.target.value })}
                              />
                              <div className="form-row">
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
                              <input
                                className="table-input"
                                required
                                min="0"
                                step="0.001"
                                type="number"
                                placeholder="ราคาต่อหน่วย"
                                value={editForm.unitPrice}
                                onChange={(event) => updateEditForm({ unitPrice: event.target.value })}
                              />
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
                              <textarea
                                className="table-input table-textarea"
                                placeholder="หมายเหตุ"
                                value={editForm.note}
                                onChange={(event) => updateEditForm({ note: event.target.value })}
                              />
                              <div className="table-actions">
                                <button type="button" disabled={updating} onClick={() => saveEdit(saleRecord.id)}>
                                  {updating ? "บันทึก..." : "บันทึก"}
                                </button>
                                <button type="button" className="btn-ghost" onClick={cancelEdit}>
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="detail-actions">
                              <button type="button" className="secondary" onClick={() => startEdit(saleRecord)}>
                                แก้ไขรายการนี้
                              </button>
                              <button type="button" className="btn-danger" onClick={() => deleteSaleRecord(saleRecord.id)}>
                                ลบ
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
