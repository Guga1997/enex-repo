-- ხელით კორექცია მარაგზე: სინქი ნაშთს მიმწოდებლების ჯამით წერს, კორექცია მას ემატება
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockAdjust" INTEGER NOT NULL DEFAULT 0;
-- ლოგში — რატომ შეიცვალა ხელით
ALTER TABLE "StockSyncLog" ADD COLUMN IF NOT EXISTS "note" TEXT;
