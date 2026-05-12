import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type LocalPurchase = {
  id: number;
  itemName: string;
  supplier: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
  purchaseDate: string;
  paymentDates: string[];
  paymentAmounts: number[];
  note: string | null;
  createdAt: string;
};

const dataDir = process.env.VERCEL
  ? path.join("/tmp", "fertilizer-crm-data")
  : path.join(process.cwd(), ".local-data");
const dataFile = path.join(dataDir, "purchases.json");

export const canUseLocalPurchases = () =>
  process.env.NODE_ENV !== "production" || !process.env.DATABASE_URL;

export async function readLocalPurchases() {
  try {
    const file = await readFile(dataFile, "utf8");
    const purchases = JSON.parse(file);

    return Array.isArray(purchases)
      ? purchases.map((purchase) => {
          const legacyPaymentDate =
            typeof purchase.paymentDate === "string" ? purchase.paymentDate : null;

          return {
            ...purchase,
            paymentDates: Array.isArray(purchase.paymentDates)
              ? purchase.paymentDates
              : legacyPaymentDate
                ? [legacyPaymentDate]
                : [],
            paymentAmounts: Array.isArray(purchase.paymentAmounts)
              ? purchase.paymentAmounts
              : [],
          };
        }) as LocalPurchase[]
      : [];
  } catch {
    return [];
  }
}

export async function writeLocalPurchases(purchases: LocalPurchase[]) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(purchases, null, 2));
}

export async function createLocalPurchases(
  items: Array<Omit<LocalPurchase, "id" | "createdAt">>,
) {
  const purchases = await readLocalPurchases();
  const nextId = purchases.reduce((max, purchase) => Math.max(max, purchase.id), 0) + 1;
  const now = new Date().toISOString();
  const newPurchases = items.map((item, index) => ({
    ...item,
    id: nextId + index,
    createdAt: now,
  }));

  await writeLocalPurchases([...newPurchases, ...purchases]);

  return newPurchases;
}

export async function deleteLocalPurchase(id: number) {
  const purchases = await readLocalPurchases();
  const nextPurchases = purchases.filter((purchase) => purchase.id !== id);

  await writeLocalPurchases(nextPurchases);

  return purchases.length !== nextPurchases.length;
}

export async function updateLocalPurchase(
  id: number,
  values: Omit<LocalPurchase, "id" | "createdAt">,
) {
  const purchases = await readLocalPurchases();
  let updatedPurchase: LocalPurchase | null = null;
  const nextPurchases = purchases.map((purchase) => {
    if (purchase.id !== id) {
      return purchase;
    }

    updatedPurchase = {
      ...purchase,
      ...values,
    };

    return updatedPurchase;
  });

  if (!updatedPurchase) {
    return null;
  }

  await writeLocalPurchases(nextPurchases);

  return updatedPurchase;
}
