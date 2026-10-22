-- მიმწოდებლის საცალო პროდუქტზე — პარტნიორების საფეხურების ბაზა
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "listPrice" DOUBLE PRECISION;
