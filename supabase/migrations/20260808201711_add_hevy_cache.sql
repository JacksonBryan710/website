-- Single-row cache of the most recent Hevy workout, written by the
-- refresh-hevy-cache Edge Function via the service_role key (bypasses RLS,
-- same pattern as feed_cache). No write policy needed for that reason.
create table public.hevy_cache (
    id               uuid primary key default gen_random_uuid(),
    workout_id       text not null unique,
    title            text not null,
    performed_at     timestamptz not null,
    total_volume_kg  numeric not null,
    fetched_at       timestamptz not null default now()
);

alter table public.hevy_cache enable row level security;
create policy "hevy_cache_public_read" on public.hevy_cache for select to anon, authenticated using (true);

grant select on public.hevy_cache to anon, authenticated;

-- service_role bypasses RLS but still needs the underlying grant (same gap
-- as feed_cache — see 20260808025129_grant_feed_cache_service_role.sql).
grant select, insert, update, delete on public.hevy_cache to service_role;
