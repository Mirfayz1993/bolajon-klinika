-- Lab panel test support: parentId self-referential on LabTestType
ALTER TABLE "lab_test_types" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

ALTER TABLE "lab_test_types"
  ADD CONSTRAINT "lab_test_types_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "lab_test_types"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "lab_test_types_parentId_idx" ON "lab_test_types"("parentId");
