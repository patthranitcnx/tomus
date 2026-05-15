/**
 * Migrate SaleRecord -> Invoice
 *
 * Usage:
 *   npx tsx scripts/migrate-sale-records.ts          # dry-run, prints report only
 *   npx tsx scripts/migrate-sale-records.ts --apply  # actually write changes
 *
 * Match rule (strict):
 *   - customerId matches (resolved from SaleRecord.customer name, case-insensitive)
 *   - total within ±0.01
 *   - saleDate same calendar day as invoice.createdAt
 *   - invoice.itemName is null/empty (not yet filled)
 *
 * Everything else gets a fresh Invoice with needsReview=true.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const PLACEHOLDER_SALESPERSON = "ไม่ระบุ";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function approxEqual(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

function inferStatus(total: number, paymentAmounts: number[]) {
  const paid = paymentAmounts.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  if (paid <= 0) return "รอชำระ";
  if (paid + 0.01 >= total) return "ชำระแล้ว";
  return "ชำระบางส่วน";
}

async function ensurePlaceholderSalesperson() {
  const existing = await prisma.salesperson.findFirst({ where: { name: PLACEHOLDER_SALESPERSON } });
  if (existing) return existing;
  if (!APPLY) {
    return { id: -1, name: PLACEHOLDER_SALESPERSON } as { id: number; name: string };
  }
  return prisma.salesperson.create({ data: { name: PLACEHOLDER_SALESPERSON } });
}

async function ensureCustomerByName(
  name: string,
  phone: string | null,
  address: string | null,
  cache: Map<string, { id: number; name: string; phone: string | null; address: string | null }>,
) {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  let customer = await prisma.customer.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" } },
  });

  if (!customer) {
    if (!APPLY) {
      const stub = { id: -Math.floor(Math.random() * 1e6), name: name.trim(), phone, address };
      cache.set(key, stub);
      return stub;
    }
    customer = await prisma.customer.create({
      data: { name: name.trim(), phone: phone || null, address: address || null },
    });
  } else if (APPLY) {
    const nextPhone = customer.phone || phone || null;
    const nextAddress = customer.address || address || null;
    if (nextPhone !== customer.phone || nextAddress !== customer.address) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { phone: nextPhone, address: nextAddress },
      });
    }
  }

  cache.set(key, { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address });
  return cache.get(key)!;
}

async function main() {
  console.log(`\n=== SaleRecord → Invoice migration (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`);

  const [saleRecords, invoices] = await Promise.all([
    prisma.saleRecord.findMany({ orderBy: { saleDate: "asc" } }),
    prisma.invoice.findMany(),
  ]);

  console.log(`SaleRecords: ${saleRecords.length}`);
  console.log(`Invoices:    ${invoices.length}\n`);

  const customerCache = new Map<string, { id: number; name: string; phone: string | null; address: string | null }>();
  const placeholderSalesperson = await ensurePlaceholderSalesperson();

  // counters
  let caseA = 0; // auto-merge
  let caseB = 0; // multiple invoice matches -> new + flag
  let caseC = 0; // no match, complete -> new + flag (needs salesperson, commission, invoice number)
  let caseD = 0; // missing data -> new + flag
  let backfilledInvoices = 0;

  const updatesToInvoice: Array<{ id: number; data: Prisma.InvoiceUpdateInput; reason: string }> = [];
  const inserts: Array<{ data: Prisma.InvoiceCreateInput; reason: string }> = [];
  const consumedInvoiceIds = new Set<number>();

  for (const sr of saleRecords) {
    const customerName = (sr.customer ?? "").trim();
    const missing: string[] = [];
    if (!customerName) missing.push("ชื่อลูกค้า");
    if (!sr.itemName?.trim()) missing.push("ชื่อสินค้า");
    if (!Number.isFinite(sr.total) || sr.total <= 0) missing.push("ยอดรวม");

    if (missing.length > 0) {
      caseD += 1;
      const fallbackName = customerName || "ไม่ระบุลูกค้า";
      const customer = await ensureCustomerByName(fallbackName, sr.customerPhone, sr.customerAddress, customerCache);
      inserts.push({
        data: {
          invoiceNumber: `SR-${sr.id}`,
          customer: { connect: { id: customer.id } },
          salesperson: { connect: { id: placeholderSalesperson.id } },
          itemName: sr.itemName || null,
          quantity: Number.isFinite(sr.quantity) ? sr.quantity : null,
          unit: sr.unit,
          unitPrice: Number.isFinite(sr.unitPrice) ? sr.unitPrice : null,
          note: sr.note,
          saleDate: sr.saleDate,
          paymentDates: sr.paymentDates,
          paymentAmounts: sr.paymentAmounts,
          total: Number.isFinite(sr.total) ? sr.total : 0,
          commissionRate: 0,
          commissionTons: 0,
          status: inferStatus(sr.total || 0, sr.paymentAmounts || []),
          needsReview: true,
          reviewNotes: `ข้อมูลไม่ครบ (ขาด: ${missing.join(", ")}) — กรุณาตรวจสอบและเติม • ยังไม่มีเลขที่ใบแจ้งหนี้จริง (placeholder: SR-${sr.id}) • พนักงานขายเป็น "ไม่ระบุ"`,
          commission: { create: { salesperson: { connect: { id: placeholderSalesperson.id } }, amount: 0 } },
        },
        reason: `case D: missing ${missing.join(",")}`,
      });
      continue;
    }

    const customer = await ensureCustomerByName(customerName, sr.customerPhone, sr.customerAddress, customerCache);

    // find candidate invoices to merge
    const candidates = invoices.filter((inv) => {
      if (consumedInvoiceIds.has(inv.id)) return false;
      if (inv.customerId !== customer.id) return false;
      if (!approxEqual(inv.total, sr.total)) return false;
      const invDate = inv.saleDate ?? inv.createdAt;
      if (!sameDay(new Date(invDate), new Date(sr.saleDate))) return false;
      if (inv.itemName && inv.itemName.trim()) return false; // already filled
      return true;
    });

    if (candidates.length === 1) {
      caseA += 1;
      const target = candidates[0];
      consumedInvoiceIds.add(target.id);
      updatesToInvoice.push({
        id: target.id,
        data: {
          itemName: sr.itemName,
          quantity: sr.quantity,
          unit: sr.unit,
          unitPrice: sr.unitPrice,
          note: target.note || sr.note,
          saleDate: target.saleDate || sr.saleDate,
          paymentDates: target.paymentDates.length ? target.paymentDates : sr.paymentDates,
          paymentAmounts: target.paymentAmounts.length ? target.paymentAmounts : sr.paymentAmounts,
          needsReview: false,
          reviewNotes: null,
        },
        reason: `case A: merge SR-${sr.id} into INV ${target.invoiceNumber}`,
      });
      continue;
    }

    if (candidates.length > 1) {
      caseB += 1;
      const matchNumbers = candidates.map((c) => c.invoiceNumber).join(", ");
      inserts.push({
        data: {
          invoiceNumber: `SR-${sr.id}`,
          customer: { connect: { id: customer.id } },
          salesperson: { connect: { id: placeholderSalesperson.id } },
          itemName: sr.itemName,
          quantity: sr.quantity,
          unit: sr.unit,
          unitPrice: sr.unitPrice,
          note: sr.note,
          saleDate: sr.saleDate,
          paymentDates: sr.paymentDates,
          paymentAmounts: sr.paymentAmounts,
          total: sr.total,
          commissionRate: 0,
          commissionTons: 0,
          status: inferStatus(sr.total, sr.paymentAmounts || []),
          needsReview: true,
          reviewNotes: `พบใบแจ้งหนี้เดิม ${candidates.length} ใบที่ตรงเงื่อนไข ไม่สามารถเลือกอัตโนมัติได้ (${matchNumbers}) — กรุณาตรวจสอบและรวมเข้าใบที่ถูกต้อง • พนักงานขายเป็น "ไม่ระบุ" • commissionRate=0`,
          commission: { create: { salesperson: { connect: { id: placeholderSalesperson.id } }, amount: 0 } },
        },
        reason: `case B: ambiguous match`,
      });
      continue;
    }

    // no match
    caseC += 1;
    inserts.push({
      data: {
        invoiceNumber: `SR-${sr.id}`,
        customer: { connect: { id: customer.id } },
        salesperson: { connect: { id: placeholderSalesperson.id } },
        itemName: sr.itemName,
        quantity: sr.quantity,
        unit: sr.unit,
        unitPrice: sr.unitPrice,
        note: sr.note,
        saleDate: sr.saleDate,
        paymentDates: sr.paymentDates,
        paymentAmounts: sr.paymentAmounts,
        total: sr.total,
        commissionRate: 0,
        commissionTons: 0,
        status: inferStatus(sr.total, sr.paymentAmounts || []),
        needsReview: true,
        reviewNotes: `ย้ายมาจากรายการขาย — กรุณาระบุ: เลขที่ใบแจ้งหนี้จริง (ปัจจุบัน SR-${sr.id}), พนักงานขาย ("ไม่ระบุ"), commissionRate, commissionTons`,
        commission: { create: { salesperson: { connect: { id: placeholderSalesperson.id } }, amount: 0 } },
      },
      reason: `case C: no match, create new`,
    });
  }

  // backfill existing invoices that have no itemName and weren't consumed by any merge
  for (const inv of invoices) {
    if (consumedInvoiceIds.has(inv.id)) continue;
    if (inv.itemName && inv.itemName.trim()) continue;
    backfilledInvoices += 1;
    updatesToInvoice.push({
      id: inv.id,
      data: {
        itemName: "ไม่ระบุสินค้า",
        quantity: 1,
        unitPrice: inv.total,
        saleDate: inv.saleDate || inv.createdAt,
        needsReview: true,
        reviewNotes: "ใบแจ้งหนี้เดิมยังไม่มีข้อมูลสินค้า — กรุณาเติม: ชื่อสินค้า, จำนวน, หน่วย, ราคา/หน่วย",
      },
      reason: `backfill invoice ${inv.invoiceNumber}`,
    });
  }

  // report
  console.log("--- ผลการ match ---");
  console.log(`  A. auto-merge (1:1):            ${caseA}`);
  console.log(`  B. ambiguous (หลายใบ → flag):    ${caseB}`);
  console.log(`  C. no match (สร้างใหม่ + flag): ${caseC}`);
  console.log(`  D. missing data (+ flag):        ${caseD}`);
  console.log(`  Backfill invoice เดิม (+ flag):  ${backfilledInvoices}\n`);
  console.log(`updates: ${updatesToInvoice.length}, inserts: ${inserts.length}\n`);

  const flaggedAfter = caseB + caseC + caseD + backfilledInvoices;
  console.log(`รายการที่ต้องให้แอดมินตรวจหลัง migrate: ${flaggedAfter}\n`);

  if (!APPLY) {
    console.log("ℹ️  DRY-RUN — ยังไม่เขียนข้อมูล (รัน --apply เพื่อ commit จริง)");
    await prisma.$disconnect();
    return;
  }

  console.log("✍️  APPLYING...");
  await prisma.$transaction(async (tx) => {
    for (const ins of inserts) {
      await tx.invoice.create({ data: ins.data });
    }
    for (const upd of updatesToInvoice) {
      await tx.invoice.update({ where: { id: upd.id }, data: upd.data });
    }
  }, { timeout: 120_000 });

  console.log("✅ Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
