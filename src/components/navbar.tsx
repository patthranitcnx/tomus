"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileText, LayoutDashboard, Sprout, Users, WalletCards } from "lucide-react";

const navItems = [
  { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/customers", label: "ลูกค้า", icon: Users },
  { href: "/invoices", label: "ใบแจ้งหนี้", icon: FileText },
  { href: "/sales", label: "ทีมขาย", icon: WalletCards },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <aside className="app-sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">
          <Sprout size={20} />
        </span>
        <span>
          <strong>Fertilizer CRM</strong>
          <small>Sales operations</small>
        </span>
      </Link>

      <nav className="app-nav" aria-label="เมนูหลัก">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link key={item.href} href={item.href} className={active ? "active" : ""}>
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
