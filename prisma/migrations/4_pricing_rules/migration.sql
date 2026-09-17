-- ფასწარმოქმნის წესები მიმწოდებელი × სეგმენტი
CREATE TABLE "SupplierPricingRule" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "retailBase" TEXT NOT NULL DEFAULT 'COST',
    "markupRetail" DOUBLE PRECISION NOT NULL,
    "markupDealer" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "SupplierPricingRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierPricingRule_supplierId_categoryId_key" ON "SupplierPricingRule"("supplierId", "categoryId");
ALTER TABLE "SupplierPricingRule" ADD CONSTRAINT "SupplierPricingRule_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierPricingRule" ADD CONSTRAINT "SupplierPricingRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
