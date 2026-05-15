export type SanitizedItem = {
  itemName: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  position: number;
};

export const sanitizeItems = (raw: unknown): SanitizedItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index): SanitizedItem | null => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      const itemName = String(obj.itemName ?? "").trim();
      if (!itemName) return null;
      const quantity = Number(obj.quantity);
      const unitPrice = Number(obj.unitPrice);
      if (!Number.isFinite(quantity) || quantity < 0) return null;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return null;
      const unit = obj.unit != null ? String(obj.unit).trim() || null : null;
      return { itemName, quantity, unit, unitPrice, position: index };
    })
    .filter((item): item is SanitizedItem => item !== null);
};

export const computeItemsTotal = (items: SanitizedItem[]) =>
  items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
