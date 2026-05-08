import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Fertilizer CRM",
  description: "ระบบ CRM สำหรับธุรกิจขายปุ๋ย เพื่อจัดการลูกค้า บัญชี และคอมมิชชั่น",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <div className="app-frame">
          <Navbar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
