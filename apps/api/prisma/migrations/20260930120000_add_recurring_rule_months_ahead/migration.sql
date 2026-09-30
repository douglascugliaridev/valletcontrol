-- Horizonte opcional da regra recorrente.
--
-- `monthsAhead` limita quantos meses a regra gera a partir de
-- startMonth/startYear (inclusive). NULL = sem prazo, que e o
-- comportamento anterior e o certo para contas fixas (aluguel,
-- energia) que nao tem data de termino.
--
-- A coluna e nullable de proposito: regras ja existentes ficam com
-- NULL e nao mudam de comportamento.
ALTER TABLE "recurring_rules" ADD COLUMN IF NOT EXISTS "monthsAhead" INTEGER;
