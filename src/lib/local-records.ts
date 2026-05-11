import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type LocalSaleRecord = {
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
  note: string | null;
  createdAt: string;
};

export type LocalExpense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  note: string | null;
  createdAt: string;
};

const dataDir = process.env.VERCEL
  ? path.join("/tmp", "fertilizer-crm-data")
  : path.join(process.cwd(), ".local-data");

export const canUseLocalRecords = () =>
  process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL;

async function readRecords<T>(fileName: string) {
  try {
    const file = await readFile(path.join(dataDir, fileName), "utf8");
    const records = JSON.parse(file);

    return Array.isArray(records) ? (records as T[]) : [];
  } catch {
    return [];
  }
}

async function writeRecords<T>(fileName: string, records: T[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(path.join(dataDir, fileName), JSON.stringify(records, null, 2));
}

function nextId<T extends { id: number }>(records: T[]) {
  return records.reduce((max, record) => Math.max(max, record.id), 0) + 1;
}

export async function readLocalSaleRecords() {
  const records = await readRecords<LocalSaleRecord & { paymentDate?: string | null }>("sale-records.json");

  return records.map((record) => {
    const legacyPaymentDate = typeof record.paymentDate === "string" ? record.paymentDate : null;
    const { paymentDate, ...nextRecord } = record;

    return {
      ...nextRecord,
      paymentDates: Array.isArray(record.paymentDates)
        ? record.paymentDates
        : legacyPaymentDate
          ? [legacyPaymentDate]
          : [],
    };
  });
}

export async function createLocalSaleRecord(record: Omit<LocalSaleRecord, "id" | "createdAt">) {
  const records = await readLocalSaleRecords();
  const newRecord = {
    ...record,
    id: nextId(records),
    createdAt: new Date().toISOString(),
  };

  await writeRecords("sale-records.json", [newRecord, ...records]);

  return newRecord;
}

export async function deleteLocalSaleRecord(id: number) {
  const records = await readLocalSaleRecords();
  const nextRecords = records.filter((record) => record.id !== id);

  await writeRecords("sale-records.json", nextRecords);

  return records.length !== nextRecords.length;
}

export async function updateLocalSaleRecord(
  id: number,
  values: Omit<LocalSaleRecord, "id" | "createdAt">,
) {
  const records = await readLocalSaleRecords();
  let updatedRecord: LocalSaleRecord | null = null;
  const nextRecords = records.map((record) => {
    if (record.id !== id) {
      return record;
    }

    updatedRecord = {
      ...record,
      ...values,
    };

    return updatedRecord;
  });

  if (!updatedRecord) {
    return null;
  }

  await writeRecords("sale-records.json", nextRecords);

  return updatedRecord;
}

export async function readLocalExpenses() {
  return readRecords<LocalExpense>("expenses.json");
}

export async function createLocalExpense(record: Omit<LocalExpense, "id" | "createdAt">) {
  const records = await readLocalExpenses();
  const newRecord = {
    ...record,
    id: nextId(records),
    createdAt: new Date().toISOString(),
  };

  await writeRecords("expenses.json", [newRecord, ...records]);

  return newRecord;
}

export async function deleteLocalExpense(id: number) {
  const records = await readLocalExpenses();
  const nextRecords = records.filter((record) => record.id !== id);

  await writeRecords("expenses.json", nextRecords);

  return records.length !== nextRecords.length;
}

export async function updateLocalExpense(
  id: number,
  values: Omit<LocalExpense, "id" | "createdAt">,
) {
  const records = await readLocalExpenses();
  let updatedExpense: LocalExpense | null = null;
  const nextRecords = records.map((record) => {
    if (record.id !== id) {
      return record;
    }

    updatedExpense = {
      ...record,
      ...values,
    };

    return updatedExpense;
  });

  if (!updatedExpense) {
    return null;
  }

  await writeRecords("expenses.json", nextRecords);

  return updatedExpense;
}
