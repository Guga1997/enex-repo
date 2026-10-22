-- ფასდადება იმ პოზიციებზე, რომლებსაც მიმწოდებელი საცალოს არ აწვდის
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "noListMarkup" DOUBLE PRECISION;
