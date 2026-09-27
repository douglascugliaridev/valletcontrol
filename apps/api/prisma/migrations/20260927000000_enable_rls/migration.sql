-- ============================================================================
-- Row Level Security (RLS)
--
-- O banco roda no Supabase, que expoe o schema `public` via Data API (PostgREST).
-- Sem RLS, a chave `anon` (publica por natureza) lia e escrevia todas as
-- tabelas, inclusive `users` (que guarda `passwordHash`).
--
-- Decisoes:
--   * apenas ENABLE ROW LEVEL SECURITY, sem FORCE. A API (Prisma) conecta com a
--     role `postgres`, que no Supabase tem BYPASSRLS e portanto ignora RLS por
--     completo. O comportamento da API nao muda.
--   * Policies so para a role `authenticated`, baseadas em `auth.uid()`, que e o
--     id do usuario. Sem JWT, `auth.uid()` e NULL e o Data API devolve zero
--     linhas (fail-closed). A `service_role` (service key) mantem acesso total.
--   * INSERT em `users` fica bloqueado: o cadastro e feito pela API.
--   * Idempotente: cada policy e precedida de DROP POLICY IF EXISTS.
--
-- Ressalva sobre `users.id`: hoje e um cuid (ex.: cmuev5o0a0000hnq283sr7qyo),
-- e `auth.uid()` devolve uuid. Entao, com os ids atuais, o Data API sempre
-- recebe zero linhas — que e o estado desejado, ja que este projeto nao usa
-- o Data API. As policies comecam a valer linha a linha no dia em que a
-- autenticacao migrar para o Supabase Auth (ids uuid), sem nenhuma alteracao
-- de SQL. Se um dia o `sub` do JWT for um cuid em vez de uuid, `auth.uid()`
-- estoura 22P02 em vez de negar; nesse caso trocar por um helper em text:
--   current_setting('request.jwt.claim.sub', true)
-- ============================================================================

-- 1) Habilita RLS
DO $$
DECLARE
    tabela text;
BEGIN
    FOREACH tabela IN ARRAY ARRAY['users', 'transactions', 'cards', 'recurring_rules']
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    END LOOP;
END
$$;

-- 2) Policies de isolamento por dono
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'auth' AND p.proname = 'uid'
    ) THEN
        RAISE NOTICE 'Schema auth ausente (Postgres sem Supabase Auth): RLS habilitado sem policies; API nao afetada. Se for preciso criar as policies depois, rode este arquivo novamente.';
        RETURN;
    END IF;

    -- users: raiz do tenant
    EXECUTE 'DROP POLICY IF EXISTS users_read_own   ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS users_update_own ON public.users';
    EXECUTE 'DROP POLICY IF EXISTS users_delete_own ON public.users';
    EXECUTE $p$
        CREATE POLICY users_read_own ON public.users
            FOR SELECT TO authenticated
            USING ((SELECT auth.uid())::text = id)
    $p$;
    EXECUTE $p$
        CREATE POLICY users_update_own ON public.users
            FOR UPDATE TO authenticated
            USING ((SELECT auth.uid())::text = id)
            WITH CHECK ((SELECT auth.uid())::text = id)
    $p$;
    EXECUTE $p$
        CREATE POLICY users_delete_own ON public.users
            FOR DELETE TO authenticated
            USING ((SELECT auth.uid())::text = id)
    $p$;

    -- cards / transactions / recurring_rules: isolados por ownerId
    EXECUTE 'DROP POLICY IF EXISTS cards_own ON public.cards';
    EXECUTE $p$
        CREATE POLICY cards_own ON public.cards
            FOR ALL TO authenticated
            USING ("ownerId" = (SELECT auth.uid())::text)
            WITH CHECK ("ownerId" = (SELECT auth.uid())::text)
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS transactions_own ON public.transactions';
    EXECUTE $p$
        CREATE POLICY transactions_own ON public.transactions
            FOR ALL TO authenticated
            USING ("ownerId" = (SELECT auth.uid())::text)
            WITH CHECK ("ownerId" = (SELECT auth.uid())::text)
    $p$;

    EXECUTE 'DROP POLICY IF EXISTS recurring_rules_own ON public.recurring_rules';
    EXECUTE $p$
        CREATE POLICY recurring_rules_own ON public.recurring_rules
            FOR ALL TO authenticated
            USING ("ownerId" = (SELECT auth.uid())::text)
            WITH CHECK ("ownerId" = (SELECT auth.uid())::text)
    $p$;
END
$$;
