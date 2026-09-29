-- თანამშრომლის ანგარიშის გათიშვა წაშლის გარეშე
ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
