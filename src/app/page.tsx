import Link from "next/link";
import { ArrowUpRight, FilePlus2, ReceiptText, UserPlus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
});

export default async function HomePage() {
  const [customers, salespeople, invoiceSummary, invoices, commissions] = await Promise.all([
    prisma.customer.count(),
    prisma.salesperson.count(),
    prisma.invoice.aggregate({
      _count: true,
      _sum: {
        total: true,
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

  const totalSales = invoiceSummary._sum.total ?? 0;
  const totalCommissions = commissions.reduce((sum, commission) => sum + commission.amount, 0);
  const unpaidCommissions = commissions
    .filter((commission) => !commission.paid)
    .reduce((sum, commission) => sum + commission.amount, 0);

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
          <Link className="button" href="/invoices">
            <FilePlus2 size={18} />
            ออกใบแจ้งหนี้
          </Link>
        </div>
      </header>

      <section className="metric-grid">
        <article className="metric-card accent-green">
          <span>ยอดขายล่าสุด</span>
          <strong>{money.format(totalSales)}</strong>
          <small>จากใบแจ้งหนี้ {invoiceSummary._count} ใบ</small>
        </article>
        <article className="metric-card accent-blue">
          <span>ลูกค้า</span>
          <strong>{customers}</strong>
          <small>รายชื่อในระบบ</small>
        </article>
        <article className="metric-card accent-amber">
          <span>ทีมขาย</span>
          <strong>{salespeople}</strong>
          <small>คนที่พร้อมรับงานขาย</small>
        </article>
        <article className="metric-card accent-red">
          <span>คอมมิชชั่นค้างจ่าย</span>
          <strong>{money.format(unpaidCommissions)}</strong>
          <small>จากคอมมิชชั่นรวม {money.format(totalCommissions)}</small>
        </article>
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
                    <span className={`status-pill ${invoice.status.toLowerCase()}`}>{invoice.status}</span>
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
