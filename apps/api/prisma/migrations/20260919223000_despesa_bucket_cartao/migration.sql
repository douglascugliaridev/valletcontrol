-- Despesa passa a ter bucket fixo (CONTAS_FIXAS/OUTROS) OU cartão via cardId.
-- 1) Cria cartões padrão "Nubank"/"Itaucard" por dono (idempotente).
INSERT INTO "cards" ("id", "ownerId", "name", "brand", "last4", "color", "isDefault", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", c.name, c.brand, NULL, NULL, false, now(), now()
FROM "users" u
CROSS JOIN (
  VALUES ('Nubank', 'NUBANK'::"CardBrand"), ('Itaucard', 'ITAUCARD'::"CardBrand")
) AS c (name, brand)
WHERE NOT EXISTS (
  SELECT 1 FROM "cards" cc
  WHERE cc."ownerId" = u."id" AND lower(cc.name) = lower(c.name)
);

-- 2) Antes do backfill, categoria passa a ser opcional nas transações.
ALTER TABLE "transactions" ALTER COLUMN "category" DROP NOT NULL;

-- 3) Despesas com categoria NUBANK/ITAUCARD passam a usar o cartão como bucket
--    (category -> NULL, cardId -> cartão do dono correspondente à categoria).
UPDATE "transactions" t
SET "category" = NULL,
    "cardId" = CASE WHEN t."cardId" IS NULL THEN c."id" ELSE t."cardId" END
FROM "cards" c
WHERE t."category" IN ('NUBANK', 'ITAUCARD')
  AND c."ownerId" = t."ownerId"
  AND lower(c."name") = CASE t."category" WHEN 'NUBANK' THEN 'nubank' ELSE 'itaucard' END;

-- 4) Regras recorrentes não possuem cartão: categoria de cartão vira "outros".
UPDATE "recurring_rules" SET "category" = 'OUTROS' WHERE "category" IN ('NUBANK', 'ITAUCARD');

-- 5) Enum "Category" sem NUBANK/ITAUCARD sobre os valores já saneados.
ALTER TYPE "Category" RENAME TO "Category_old";
CREATE TYPE "Category" AS ENUM ('CONTAS_FIXAS', 'OUTROS', 'RECEITA', 'DEVEDORES');
ALTER TABLE "transactions" ALTER COLUMN "category" TYPE "Category" USING ("category"::text::"Category");
ALTER TABLE "recurring_rules" ALTER COLUMN "category" TYPE "Category" USING ("category"::text::"Category");
DROP TYPE "Category_old";