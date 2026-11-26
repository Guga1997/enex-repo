-- კატალოგის მენიუს ფილის მოკლე სახელი (ცარიელი — სრული სახელი ჩანს)
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "menuName" TEXT;
