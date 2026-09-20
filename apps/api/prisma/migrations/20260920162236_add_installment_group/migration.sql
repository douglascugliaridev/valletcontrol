-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installmentGroupId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_installmentGroupId_idx" ON "transactions"("installmentGroupId");

-- Backfill: agrupa parcelas existentes no padrão "i/N descrição"
-- (mesmo dono, descrição sem o prefixo, mesmo valor e tipo, mais de 1 lançamento).
WITH groups AS (
  SELECT
    "ownerId",
    regexp_replace("description", '^[0-9]+/[0-9]+\s*', '') AS stripped,
    "amountCents",
    "type",
    gen_random_uuid()::text AS gid
  FROM "transactions"
  WHERE "description" ~ '^[0-9]+/[0-9]+\s'
  GROUP BY "ownerId", stripped, "amountCents", "type"
  HAVING count(*) > 1
)
UPDATE "transactions" AS t
SET "installmentGroupId" = g.gid
FROM groups AS g
WHERE t."ownerId" = g."ownerId"
  AND t."amountCents" = g."amountCents"
  AND t."type" = g."type"
  AND t."description" ~ '^[0-9]+/[0-9]+\s'
  AND regexp_replace(t."description", '^[0-9]+/[0-9]+\s*', '') = g.stripped;
