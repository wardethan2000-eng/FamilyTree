-- Add name_parts field for structured name handling
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "first_name" varchar(200);
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "last_name" varchar(200);
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "maiden_name" varchar(200);