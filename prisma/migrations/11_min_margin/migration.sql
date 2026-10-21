-- მინიმალური მოგება: ფასი თვითღირებულებაზე ამ პროცენტით მაინც მაღლა დგება
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "minMargin" DOUBLE PRECISION NOT NULL DEFAULT 0;
