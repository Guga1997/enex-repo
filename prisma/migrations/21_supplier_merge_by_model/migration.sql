-- მოდელით გაერთიანება სხვა მიმწოდებლის პროდუქტთან. false — ეს მიმწოდებელი ყოველთვის თავის
-- ცალკე პროდუქტს ქმნის და არც სხვისი ნივთი ერევა მისას (ალტა: MUK-ის პროდუქტს არ უნდა ჩაენაცვლოს).
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "mergeByModel" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Supplier" SET "mergeByModel" = false WHERE "adapter" = 'ALTA';
