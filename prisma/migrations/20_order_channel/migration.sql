-- საიდან მოვიდა შეკვეთა: WEB — საიტი; STAFF_INVOICE — ადმინიდან გამოწერილი ინვოისი; STORE — მაღაზიის გაყიდვა
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'WEB';
-- ვინ მოამზადა (თანამშრომლის სახელი) — მხოლოდ ადმინიდან შექმნილზე
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "staffName" TEXT;
CREATE INDEX IF NOT EXISTS "Order_channel_idx" ON "Order"("channel");
