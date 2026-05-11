ALTER TABLE "Purchase" ADD COLUMN "paymentDates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];
ALTER TABLE "SaleRecord" ADD COLUMN "paymentDates" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];

UPDATE "Purchase"
SET "paymentDates" = ARRAY["paymentDate"]::TIMESTAMP(3)[]
WHERE "paymentDate" IS NOT NULL;

UPDATE "SaleRecord"
SET "paymentDates" = ARRAY["paymentDate"]::TIMESTAMP(3)[]
WHERE "paymentDate" IS NOT NULL;

ALTER TABLE "Purchase" DROP COLUMN "paymentDate";
ALTER TABLE "SaleRecord" DROP COLUMN "paymentDate";
