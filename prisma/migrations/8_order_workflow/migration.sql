-- შეკვეთის მუშა პროცესი: განყოფილებების ნაბიჯები და მათი მონაცემები
CREATE TABLE IF NOT EXISTS "OrderFulfillment" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "supplierName" TEXT,
  "supplierInvoice" TEXT,
  "pickupAddress" TEXT,
  "pickupAt" TIMESTAMP(3),
  "weightKg" DOUBLE PRECISION,
  "dimensions" TEXT,
  "deliveryNote" TEXT,
  "waybillNumber" TEXT,
  "waybillUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderFulfillment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderFulfillment_orderId_key" ON "OrderFulfillment"("orderId");

CREATE TABLE IF NOT EXISTS "OrderStep" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "note" TEXT,
  "adminId" TEXT,
  "byName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderStep_orderId_step_key" ON "OrderStep"("orderId", "step");
CREATE INDEX IF NOT EXISTS "OrderStep_orderId_idx" ON "OrderStep"("orderId");

DO $$ BEGIN
  ALTER TABLE "OrderFulfillment" ADD CONSTRAINT "OrderFulfillment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderStep" ADD CONSTRAINT "OrderStep_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderStep" ADD CONSTRAINT "OrderStep_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
