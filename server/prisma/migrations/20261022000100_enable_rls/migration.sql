-- Supabase expose le schéma "public" via son API REST (PostgREST) avec la clé "anon".
-- L'application n'accède à la base que par Prisma (rôle propriétaire des tables, non soumis au RLS) :
-- on active le Row Level Security SANS aucune policy pour bloquer tout accès via l'API Supabase.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
