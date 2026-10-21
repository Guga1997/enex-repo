-- მიმწოდებლის ფასი უკვე შეიცავს ჩვენს ფასდაკლებას (მინიმუმ ამდენ პროცენტს)
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "supplierDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0;
