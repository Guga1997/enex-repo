-- API გასაღები შეიძლება ერთ კატეგორიაზე იყოს შეზღუდული
ALTER TABLE "ApiKey" ADD COLUMN IF NOT EXISTS "categorySlug" TEXT;
