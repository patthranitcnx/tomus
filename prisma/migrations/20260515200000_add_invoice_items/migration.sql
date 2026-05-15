-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single-item data from Invoice → InvoiceItem
INSERT INTO "InvoiceItem" ("invoiceId", "itemName", "quantity", "unit", "unitPrice", "position")
SELECT
    "id",
    COALESCE(NULLIF(TRIM("itemName"), ''), 'ไม่ระบุ'),
    COALESCE("quantity", 0),
    "unit",
    COALESCE("unitPrice", 0),
    0
FROM "Invoice"
WHERE "itemName" IS NOT NULL AND TRIM("itemName") <> '';

-- Drop old single-item columns
ALTER TABLE "Invoice" DROP COLUMN "itemName";
ALTER TABLE "Invoice" DROP COLUMN "quantity";
ALTER TABLE "Invoice" DROP COLUMN "unit";
ALTER TABLE "Invoice" DROP COLUMN "unitPrice";
