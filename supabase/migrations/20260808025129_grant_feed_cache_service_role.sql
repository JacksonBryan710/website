-- "Automatically expose new tables" being off at project creation means
-- even the admin/service role needs an explicit grant to write past RLS —
-- bypassing RLS (via ctx.supabaseAdmin in the refresh-feed-cache Edge
-- Function) still requires the underlying Postgres GRANT to exist.
grant select, insert, update, delete on public.feed_cache to service_role;
