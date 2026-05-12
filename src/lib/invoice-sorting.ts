const invoiceNumberCollator = new Intl.Collator("th-TH", {
  numeric: true,
  sensitivity: "base",
});

function getInvoiceSortParts(invoiceNumber: string) {
  const numbers = invoiceNumber
    .match(/\d+/g)
    ?.map((value) => Number(value))
    .filter((value) => Number.isFinite(value)) ?? [];

  return {
    bookNumber: numbers[0] ?? Number.POSITIVE_INFINITY,
    invoiceNumber: numbers[1] ?? Number.POSITIVE_INFINITY,
  };
}

export function compareInvoiceNumbers(a: string, b: string) {
  const aParts = getInvoiceSortParts(a);
  const bParts = getInvoiceSortParts(b);

  return (
    aParts.bookNumber - bParts.bookNumber ||
    aParts.invoiceNumber - bParts.invoiceNumber ||
    invoiceNumberCollator.compare(a.trim(), b.trim())
  );
}
