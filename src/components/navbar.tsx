"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Coins,
  Edit3,
  FileText,
  Handshake,
  LayoutDashboard,
  ReceiptText,
  ShoppingCart,
  Sprout,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

const navItems = [
  { href: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { href: "/partners", label: "สร้างคู่ค้า", icon: Handshake },
  { href: "/customers", label: "ลูกค้า", icon: Users },
  { href: "/purchases", label: "รายการซื้อ", icon: ShoppingCart },
  { href: "/sale-records", label: "รายการขาย", icon: TrendingUp },
  { href: "/expenses", label: "ค่าใช้จ่าย", icon: ReceiptText },
  { href: "/invoices", label: "ใบแจ้งหนี้", icon: FileText },
  { href: "/commissions", label: "คอมมิชชั่น", icon: Coins },
  { href: "/sales", label: "ทีมขาย", icon: WalletCards },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
];

type CompanyProfile = {
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  logoDataUrl: string;
};

const profileStorageKey = "tomus.companyProfile.v1";
const defaultProfile: CompanyProfile = {
  companyName: "Fertilizer CRM",
  taxId: "",
  address: "",
  phone: "",
  logoDataUrl: "",
};

const parseStoredProfile = (raw: string | null): CompanyProfile => {
  if (!raw) {
    return defaultProfile;
  }

  try {
    const parsed = JSON.parse(raw);

    return {
      companyName: typeof parsed.companyName === "string" && parsed.companyName.trim() ? parsed.companyName : defaultProfile.companyName,
      taxId: typeof parsed.taxId === "string" ? parsed.taxId : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      logoDataUrl: typeof parsed.logoDataUrl === "string" ? parsed.logoDataUrl : "",
    };
  } catch {
    return defaultProfile;
  }
};

export function Navbar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<CompanyProfile>(defaultProfile);
  const [draft, setDraft] = useState<CompanyProfile>(defaultProfile);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const stored = parseStoredProfile(window.localStorage.getItem(profileStorageKey));
    setProfile(stored);
    setDraft(stored);
  }, []);

  useEffect(() => {
    if (!editOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEditOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editOpen]);

  const openEditor = () => {
    setDraft(profile);
    setEditOpen(true);
  };

  const saveProfile = () => {
    const normalized: CompanyProfile = {
      ...draft,
      companyName: draft.companyName.trim() || defaultProfile.companyName,
      taxId: draft.taxId.trim(),
      address: draft.address.trim(),
      phone: draft.phone.trim(),
    };

    setProfile(normalized);
    setDraft(normalized);
    window.localStorage.setItem(profileStorageKey, JSON.stringify(normalized));
    setEditOpen(false);
  };

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDraft((current) => ({ ...current, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <aside className="app-sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">
          {profile.logoDataUrl ? (
            <img src={profile.logoDataUrl} alt="โลโก้บริษัท" className="brand-logo" />
          ) : (
            <Sprout size={20} />
          )}
        </span>
        <span>
          <strong>{profile.companyName}</strong>
          <small>Sales operations</small>
        </span>
      </Link>

      <div className="company-identity">
        {profile.taxId ? <small>เลขผู้เสียภาษี: {profile.taxId}</small> : null}
        {profile.phone ? <small>โทร: {profile.phone}</small> : null}
        {profile.address ? <small className="company-address">{profile.address}</small> : null}
      </div>

      <button type="button" className="sidebar-edit-button" onClick={openEditor}>
        <Edit3 size={16} />
        <span>แก้ไขข้อมูลบริษัท</span>
      </button>

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

      {editOpen && (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditOpen(false);
            }
          }}
        >
          <div className="modal-card company-profile-modal">
            <div className="section-header">
              <div>
                <p className="eyebrow">ตั้งค่าธุรกิจ</p>
                <h2>แก้ไขข้อมูลบริษัท</h2>
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="company-name">ชื่อบริษัท</label>
              <input
                id="company-name"
                value={draft.companyName}
                onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
                placeholder="ชื่อบริษัท"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="company-tax-id">เลขประจำตัวผู้เสียภาษี</label>
              <input
                id="company-tax-id"
                value={draft.taxId}
                onChange={(event) => setDraft((current) => ({ ...current, taxId: event.target.value }))}
                placeholder="0-0000-00000-00-0"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="company-address">ที่อยู่</label>
              <textarea
                id="company-address"
                className="company-address-input"
                value={draft.address}
                onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                placeholder="ที่อยู่บริษัท"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="company-phone">เบอร์โทร</label>
              <input
                id="company-phone"
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                placeholder="02-xxx-xxxx"
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="company-logo">โลโก้มุมซ้าย</label>
              <input id="company-logo" type="file" accept="image/*" onChange={onLogoChange} />
              {draft.logoDataUrl ? (
                <div className="company-logo-preview-wrap">
                  <img src={draft.logoDataUrl} alt="ตัวอย่างโลโก้" className="company-logo-preview" />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setDraft((current) => ({ ...current, logoDataUrl: "" }))}
                  >
                    ลบโลโก้
                  </button>
                </div>
              ) : null}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                ยกเลิก
              </button>
              <button type="button" onClick={saveProfile}>บันทึกข้อมูล</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
