-- მიმწოდებლის ავტომატური სინქის ინტერვალი
ALTER TABLE "Supplier" ADD COLUMN "syncEveryMin" INTEGER NOT NULL DEFAULT 0;
