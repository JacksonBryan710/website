-- Security fix: "projects_admin_write" / "recipes_admin_write" (0001_init.sql)
-- used `to authenticated using (true) with check (true)`, which grants write
-- access to ANY signed-up user, not just a specific admin — there's no
-- user_id/owner column or auth.uid() check anywhere. Since Supabase projects
-- allow public self-signup by default and the publishable key is
-- necessarily public (shipped in the client bundle), any site visitor could
-- self-signup and then arbitrarily insert/update/delete rows in projects
-- and recipes. No legitimate write path uses these grants yet (admin UI is
-- a later phase), so revoke them now and reopen with a properly
-- admin-scoped policy once that admin identity exists.
drop policy if exists "projects_admin_write" on public.projects;
drop policy if exists "recipes_admin_write" on public.recipes;

revoke insert, update, delete on public.projects from authenticated;
revoke insert, update, delete on public.recipes from authenticated;
