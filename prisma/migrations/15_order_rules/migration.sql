-- შეკვეთის წესი პროდუქტზე: მინიმუმი, ბიჯი (შეკვრა) და ერთეული ფასთან
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minQty" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "qtyStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "unit" TEXT;
