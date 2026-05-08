'use client';

import { useState, useEffect } from 'react';

interface ReportData {
  totalSales: number;
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

export default function ReportsPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      const [invRes, commRes] = await Promise.all([
        fetch('/api/invoices'),
        fetch('/api/commissions'),
      ]);

      const invoiceData = await invRes.json();
      const commissionData = await commRes.json();
      const invoices: InvoiceData[] = Array.isArray(invoiceData) ? invoiceData : [];
      const commissions: CommissionData[] = Array.isArray(commissionData) ? commissionData : [];

      const totalSales = invoices.reduce(
        (sum, inv) => sum + inv.total,
        0
      );
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

      <div className="grid">
        <div className="metric-card accent-green">
          <h3>ยอดขายรวม</h3>
          <p>
            ฿{report.totalSales.toFixed(2)}
          </p>
        </div>
        <div className="metric-card accent-blue">
          <h3>คอมมิชชั่นรวม</h3>
          <p>
            ฿{report.totalCommissions.toFixed(2)}
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
            ฿{report.paidCommissions.toFixed(2)}
          </p>
        </div>
        <div className="metric-card accent-red">
          <h3>คอมมิชชั่นค้างจ่าย</h3>
          <p>
            ฿{report.unpaidCommissions.toFixed(2)}
          </p>
        </div>
      </div>

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
                  <td>฿{person.total.toFixed(2)}</td>
                  <td>฿{person.commission.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
