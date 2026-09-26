-- რუსული და ინგლისური სახელები/აღწერები კატალოგში
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameRu" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nameRu" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "descriptionRu" TEXT;
