-- ფასი განზრახ არ იწერება: პროდუქტი კატალოგში რჩება ფასის გარეშე („მხოლოდ წინასწარი შეკვეთით“)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "priceOnRequest" BOOLEAN NOT NULL DEFAULT false;
