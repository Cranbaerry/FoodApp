-- Grants + default privileges.
--
-- Hand-written tables in `public` did not receive the standard Supabase role
-- grants, so `service_role` (which bypasses RLS but still needs table GRANTs)
-- got "permission denied for table". This migration fixes existing tables and
-- ensures every FUTURE table/sequence in `public` is granted automatically.

-- 1) Fix all tables/sequences that exist right now.
grant select, insert, update, delete on all tables in schema public
  to anon, authenticated, service_role;
grant usage, select, update on all sequences in schema public
  to anon, authenticated, service_role;

-- 2) Auto-grant future objects (tables in public are owned by `postgres`).
alter default privileges for role postgres in schema public
  grant select, insert, update, delete, references, trigger, truncate on tables
  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select, update on sequences
  to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions
  to anon, authenticated, service_role;

-- Note: access is still gated by RLS (enabled on app tables with no public
-- policies), so granting anon/authenticated here is the Supabase default and
-- does not expose data — only the server-side service-role key can read/write.
