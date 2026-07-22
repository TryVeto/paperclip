ALTER TABLE "project_version_contracts"
  ADD COLUMN IF NOT EXISTS "receipt_history" jsonb DEFAULT '[]'::jsonb;
