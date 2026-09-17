-- ფასწარმოქმნა: მიმწოდებლის საცალო ფასი, ბაზის არჩევა, ხელით ჩაკეტილი ფასი
ALTER TABLE "Supplier" ADD COLUMN "retailBase" TEXT NOT NULL DEFAULT 'COST';
ALTER TABLE "ProductSupply" ADD COLUMN "listPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "priceLocked" BOOLEAN NOT NULL DEFAULT false;
