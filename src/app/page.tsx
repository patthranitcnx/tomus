import Link from "next/link";
import { ArrowUpRight, FilePlus2, ReceiptText, ShoppingCart, TrendingUp, UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { readLocalPurchases } from "@/lib/local-purchases";
import { readLocalExpenses, readLocalSaleRecords } from "@/lib/local-records";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const invoiceStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    PENDING: "รอชำระ",
    PAID: "ชำระแล้ว",
    CANCELLED: "ยกเลิก",
    "รอชำระ": "รอชำระ",
    "ชำระแล้ว": "ชำระแล้ว",
    "ยกเลิก": "ยกเลิก",
  };

  return labels[status] ?? status;
};

const invoiceStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    PENDING: "pending",
    PAID: "paid",
    CANCELLED: "cancelled",
    "รอชำระ": "pending",
    "ชำระแล้ว": "paid",
    "ยกเลิก": "cancelled",
  };

  return classes[status] ?? "pending";
};

export default async function HomePage() {
  let customers = 0;
  let salespeople = 0;
  let invoiceCount = 0;
  let totalSales = 0;
  let totalPurchases = 0;
  let purchaseCount = 0;
  let totalSaleRecords = 0;
  let saleRecordCount = 0;
  let totalExpenses = 0;
  let expenseCount = 0;
  let totalCommissions = 0;
  let unpaidCommissions = 0;
  let invoices: Array<{
    id: number;
    invoiceNumber: string;
    total: number;
    status: string;
    customer: { name: string };
    salesperson: { name: string };
  }> = [];

  try {
    const [
      customerCount,
      salespersonCount,
      invoiceSummary,
      purchaseSummary,
      saleRecordSummary,
      expenseSummary,
      latestInvoices,
      commissions,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.salesperson.count(),
      prisma.invoice.aggregate({
        _count: true,
        _sum: {
          total: true,
        },
      }),
      prisma.purchase.aggregate({
        _count: true,
        _sum: {
          total: true,
        },
      }),
      prisma.saleRecord.aggregate({
        _count: true,
        _sum: {
          total: true,
        },
      }),
      prisma.expense.aggregate({
        _count: true,
        _sum: {
          amount: true,
        },
      }),
      prisma.invoice.findMany({
        include: {
          customer: true,
          salesperson: true,
          commission: true,
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.commission.findMany(),
    ]);

    customers = customerCount;
    salespeople = salespersonCount;
    invoiceCount = invoiceSummary._count;
    totalSales = invoiceSummary._sum.total ?? 0;
    totalPurchases = purchaseSummary._sum.total ?? 0;
    purchaseCount = purchaseSummary._count;
    totalSaleRecords = saleRecordSummary._sum.total ?? 0;
    saleRecordCount = saleRecordSummary._count;
    totalExpenses = expenseSummary._sum.amount ?? 0;
    expenseCount = expenseSummary._count;
    totalCommissions = commissions.reduce((sum, commission) => sum + commission.amount, 0);
    unpaidCommissions = commissions
      .filter((commission) => !commission.paid)
      .reduce((sum, commission) => sum + commission.amount, 0);
    invoices = latestInvoices;
  } catch {
    const [purchases, saleRecords, expenses] = await Promise.all([
      readLocalPurchases(),
      readLocalSaleRecords(),
      readLocalExpenses(),
    ]);

    totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
    purchaseCount = purchases.length;
    totalSaleRecords = saleRecords.reduce((sum, saleRecord) => sum + saleRecord.total, 0);
    saleRecordCount = saleRecords.length;
    totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    expenseCount = expenses.length;
  }

  return (
    <div className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">ภาพรวมวันนี้</p>
          <h1>แดชบอร์ดการขาย</h1>
        </div>
        <div className="header-actions">
          <Link className="button secondary" href="/customers">
            <UserPlus size={18} />
            เพิ่มลูกค้า
          </Link>
          <Link className="button" href="/sale-records">
            <FilePlus2 size={18} />
            เพิ่มรายการขาย
          </Link>
        </div>
      </header>

      <section className="metric-grid">
        <Link className="metric-card accent-green" href="/sale-records">
          <span>รายการขาย</span>
          <strong>{money.format(totalSaleRecords)}</strong>
          <small>จากรายการขาย {saleRecordCount} รายการ</small>
        </Link>
        <Link className="metric-card accent-blue" href="/purchases">
          <span>รายการซื้อ</span>
          <strong>{money.format(totalPurchases)}</strong>
          <small>จากรายการซื้อ {purchaseCount} รายการ</small>
        </Link>
        <Link className="metric-card accent-amber" href="/expenses">
          <span>ค่าใช้จ่าย</span>
          <strong>{money.format(totalExpenses)}</strong>
          <small>จากค่าใช้จ่าย {expenseCount} รายการ</small>
        </Link>
        <Link className="metric-card accent-red" href="/invoices">
          <span>คอมมิชชั่นค้างจ่าย</span>
          <strong>{money.format(unpaidCommissions)}</strong>
          <small>ใบแจ้งหนี้ {invoiceCount} ใบ · {money.format(totalSales)}</small>
        </Link>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">ล่าสุด</p>
              <h2>ใบแจ้งหนี้</h2>
            </div>
            <Link className="text-link" href="/invoices">
              ดูทั้งหมด
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <div className="list-stack">
            {invoices.length === 0 ? (
              <div className="empty-state">
                <ReceiptText size={28} />
                <p>ยังไม่มีใบแจ้งหนี้</p>
                <Link href="/invoices">สร้างใบแรก</Link>
              </div>
            ) : (
              invoices.map((invoice) => (
                <article className="invoice-row" key={invoice.id}>
                  <div>
                    <strong>{invoice.invoiceNumber}</strong>
                    <span>{invoice.customer.name} · {invoice.salesperson.name}</span>
                  </div>
                  <div className="row-end">
                    <strong>{money.format(invoice.total)}</strong>
                    <span className={`status-pill ${invoiceStatusClass(invoice.status)}`}>
                      {invoiceStatusLabel(invoice.status)}
                    </span>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="eyebrow">งานเร็ว</p>
              <h2>ทางลัด</h2>
            </div>
          </div>
          <div className="quick-actions">
            <Link href="/purchases">
              <ShoppingCart size={18} />
              เพิ่มรายการซื้อ
            </Link>
            <Link href="/sale-records">
              <TrendingUp size={18} />
              เพิ่มรายการขาย
            </Link>
            <Link href="/expenses">
              <ReceiptText size={18} />
              บันทึกค่าใช้จ่าย
            </Link>
            <Link href="/customers">
              <Users size={18} />
              จัดการลูกค้า
            </Link>
            <Link href="/sales">
              <UserPlus size={18} />
              เพิ่มเซลส์
            </Link>
            <Link href="/reports">
              <ReceiptText size={18} />
              เปิดรายงาน
            </Link>
          </div>
        </section>
      </section>
    </div>
  );
}
