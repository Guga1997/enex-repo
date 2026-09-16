-- ნაშთის რეზერვაცია გაუფორმებელ შეკვეთებზე
ALTER TABLE "Product" ADD COLUMN "reservedQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "reservedUntil" TIMESTAMP(3);
