-- თანმიმდევრული ნომრები და ზუსტი რეზერვაცია თითო ხაზზე
CREATE TABLE IF NOT EXISTS "Counter" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "reservedQty" INTEGER NOT NULL DEFAULT 0;

-- ღია შეკვეთები: ძველი კოდი ყველა ხაზს qty-ით ათავისუფლებდა — იგივე რჩება, ოღონდ მხოლოდ მარაგში მყოფ პროდუქტზე
UPDATE "OrderItem" oi SET "reservedQty" = oi."qty"
FROM "Order" o, "Product" p
WHERE oi."orderId" = o."id" AND oi."productId" = p."id"
  AND o."reservedUntil" IS NOT NULL AND o."paymentStatus" <> 'PAID' AND p."stockStatus" = 'IN_STOCK';

-- პაროლის შეცვლა ძველ სესიებს აუქმებს
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);

-- აქციის მოხსნა ხელით ჩაკეტილ ფასს აღარ აუქმებს
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "promoKeepsLock" BOOLEAN NOT NULL DEFAULT false;
