'use client';

import { useState, useEffect } from 'react';

interface ReportData {
  totalSales: number;
  totalPurchases: number;
  totalExpenses: number;
  totalProfit: number;
  totalCommissions: number;
  invoiceCount: number;
  paidCommissions: number;
  unpaidCommissions: number;
  salesByPerson: Array<{
    name: string;
    total: number;
    commission: number;
  }>;
}

type InvoiceData = {
  total: number;
  salesperson: {
    name: string;
  };
  commission: {
    amount: number;
  } | null;
};

type CommissionData = {
  amount: number;
  paid: boolean;
};

type PurchaseData = {
  total: number;
};

type SaleRecordData = {
  total: number;
};

type ExpenseData = {
  amount: number;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const [invRes, commRes, purchaseRes, saleRecordRes, expenseRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/commissions'),
        fetch('/api/purchases'),
        fetch('/api/sale-records'),
        fetch('/api/expenses'),
      ]);

      const invoiceData = await invRes.json();
      const commissionData = await commRes.json();
      const purchaseData = await purchaseRes.json();
      const saleRecordData = await saleRecordRes.json();
      const expenseData = await expenseRes.json();
      const invoices: InvoiceData[] = Array.isArray(invoiceData) ? invoiceData : [];
      const commissions: CommissionData[] = Array.isArray(commissionData) ? commissionData : [];
      const purchases: PurchaseData[] = Array.isArray(purchaseData) ? purchaseData : [];
      const saleRecords: SaleRecordData[] = Array.isArray(saleRecordData) ? saleRecordData : [];
      const expenses: ExpenseData[] = Array.isArray(expenseData) ? expenseData : [];

      const invoiceSales = invoices.reduce(
        (sum, inv) => sum + inv.total,
        0
      );
      const saleRecordSales = saleRecords.reduce((sum, saleRecord) => sum + saleRecord.total, 0);
      const totalSales = saleRecords.length > 0 ? saleRecordSales : invoiceSales;
      const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
      const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const totalProfit = totalSales - totalPurchases - totalExpenses;
      const totalCommissions = commissions.reduce(
        (sum, c) => sum + c.amount,
        0
      );
      const paidCommissions = commissions
        .filter((c) => c.paid)
        .reduce((sum, c) => sum + c.amount, 0);
      const unpaidCommissions = totalCommissions - paidCommissions;

      const salesByPerson: Record<string, { name: string; total: number; commission: number }> = {};
      invoices.forEach((inv) => {
        const name = inv.salesperson.name;
        if (!salesByPerson[name]) {
          salesByPerson[name] = { name, total: 0, commission: 0 };
        }
        salesByPerson[name].total += inv.total;
        if (inv.commission) {
          salesByPerson[name].commission += inv.commission.amount;
        }
      });

      setReport({
        totalSales,
        totalPurchases,
        totalExpenses,
        totalProfit,
        totalCommissions,
        invoiceCount: invoices.length,
        paidCommissions,
        unpaidCommissions,
        salesByPerson: Object.values(salesByPerson),
      });
    } catch (err) {
      console.error('ไม่สามารถโหลดรายงาน');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>กำลังโหลด...</div>;
  }

  if (!report) {
    return <div>ไม่มีข้อมูล</div>;
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">รายงาน</p>
          <h1>สรุปข้อมูลธุรกิจ</h1>
        </div>
      </header>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">บัญชี</p>
            <h2>สรุปยอดบัญชี</h2>
          </div>
        </div>
        <div className="grid">
          <div className="metric-card accent-green">
            <h3>ยอดขายรวม</h3>
            <p>
              {money.format(report.totalSales)}
            </p>
          </div>
          <div className="metric-card accent-blue">
            <h3>ยอดซื้อรวม</h3>
            <p>
              {money.format(report.totalPurchases)}
            </p>
          </div>
          <div className="metric-card accent-amber">
            <h3>ค่าใช้จ่ายรวม</h3>
            <p>
              {money.format(report.totalExpenses)}
            </p>
          </div>
          <div className={`metric-card ${report.totalProfit >= 0 ? "accent-green" : "accent-red"}`}>
            <h3>กำไรรวม</h3>
            <p>
              {money.format(report.totalProfit)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="eyebrow">เอกสารขาย</p>
            <h2>ใบแจ้งหนี้และคอมมิชชั่น</h2>
          </div>
        </div>
        <div className="grid">
          <div className="metric-card accent-blue">
            <h3>คอมมิชชั่นรวม</h3>
            <p>
              {money.format(report.totalCommissions)}
            </p>
          </div>
          <div className="metric-card accent-amber">
            <h3>ใบแจ้งหนี้ทั้งหมด</h3>
            <p>
              {report.invoiceCount}
            </p>
          </div>
          <div className="metric-card accent-green">
            <h3>คอมมิชชั่นที่จ่ายแล้ว</h3>
            <p>
              {money.format(report.paidCommissions)}
            </p>
          </div>
          <div className="metric-card accent-red">
            <h3>คอมมิชชั่นค้างจ่าย</h3>
            <p>
              {money.format(report.unpaidCommissions)}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>ยอดขายและคอมมิชชั่นตามเซลส์</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ชื่อเซลส์</th>
                <th>ยอดขายรวม</th>
                <th>คอมมิชชั่น</th>
              </tr>
            </thead>
            <tbody>
              {report.salesByPerson.map((person) => (
                <tr key={person.name}>
                  <td>{person.name}</td>
                  <td>{money.format(person.total)}</td>
                  <td>{money.format(person.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
