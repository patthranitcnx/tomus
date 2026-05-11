UPDATE "Invoice"
SET "status" = CASE "status"
  WHEN 'PENDING' THEN 'รอชำระ'
  WHEN 'PAID' THEN 'ชำระแล้ว'
  WHEN 'CANCELLED' THEN 'ยกเลิก'
  ELSE "status"
END;

ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'รอชำระ';
