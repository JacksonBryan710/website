-- Replaces the single-row hevy_cache with an append-only history of Hevy
-- workouts (one row per workout) and sets (one row per logged set), so the
-- Training page can compute streaks, weekly frequency, muscle-group split,
-- personal records, and duration trends -- none of which are derivable from
-- a single latest-workout snapshot. Written by the sync-hevy-workout
-- webhook (per new workout) and the sync-hevy-history Edge Function
-- (historical backfill + periodic reconciliation), both via the
-- service_role key, same pattern as hevy_cache/feed_cache. Nothing in this
-- change writes or reads hevy_cache anymore -- it's dead as of this
-- migration, not a live comparison reference -- but the table itself is
-- left in place for now and dropped in a later migration, once the new
-- pipeline is confirmed working in production.
create table public.hevy_workouts (
    id                uuid primary key default gen_random_uuid(),
    workout_id        text not null unique,
    title             text not null,
    routine_id        text,
    started_at        timestamptz not null,
    ended_at          timestamptz,
    duration_seconds  integer,
    exercise_count    integer not null,
    total_volume_kg   numeric not null,
    fetched_at        timestamptz not null default now()
);
create index hevy_workouts_started_at_idx on public.hevy_workouts (started_at desc);

-- One row per logged set (warmup/normal/dropset/failure). exercise_title is
-- denormalized from Hevy's per-exercise "title" field so widgets never need
-- to join back to hevy_exercise_templates just to display a name.
-- performed_at is denormalized from the parent workout's started_at so
-- date-range queries (e.g. Muscle Split's "last 30 days") don't need a join.
create table public.hevy_sets (
    id                    uuid primary key default gen_random_uuid(),
    workout_id            text not null references public.hevy_workouts (workout_id) on delete cascade,
    performed_at          timestamptz not null,
    exercise_template_id  text not null,
    exercise_title        text not null,
    set_index             integer not null,
    set_type              text not null check (set_type in ('normal', 'warmup', 'dropset', 'failure')),
    weight_kg             numeric,
    reps                  integer
);
create index hevy_sets_workout_id_idx on public.hevy_sets (workout_id);
create index hevy_sets_performed_at_idx on public.hevy_sets (performed_at);
create index hevy_sets_pr_idx on public.hevy_sets (exercise_template_id, weight_kg desc, reps desc);

-- Cache of Hevy's exercise-template catalog (id -> muscle group), used to
-- bucket hevy_sets into the Muscle Split widget. Deliberately NOT a foreign
-- key from hevy_sets.exercise_template_id: the real-time webhook could log
-- a brand-new/custom exercise before sync-hevy-history's next run has
-- cached its template, and a hard FK would fail the whole workout insert
-- on that race. Unmapped exercise_template_ids just fall back to "Other" in
-- the UI until the next sync fills them in.
create table public.hevy_exercise_templates (
    id                     text primary key,
    title                  text not null,
    primary_muscle_group   text not null,
    fetched_at             timestamptz not null default now()
);

alter table public.hevy_workouts enable row level security;
create policy "hevy_workouts_public_read" on public.hevy_workouts for select to anon, authenticated using (true);
grant select on public.hevy_workouts to anon, authenticated;
grant select, insert, update, delete on public.hevy_workouts to service_role;

alter table public.hevy_sets enable row level security;
create policy "hevy_sets_public_read" on public.hevy_sets for select to anon, authenticated using (true);
grant select on public.hevy_sets to anon, authenticated;
grant select, insert, update, delete on public.hevy_sets to service_role;

alter table public.hevy_exercise_templates enable row level security;
create policy "hevy_exercise_templates_public_read" on public.hevy_exercise_templates for select to anon, authenticated using (true);
grant select on public.hevy_exercise_templates to anon, authenticated;
grant select, insert, update, delete on public.hevy_exercise_templates to service_role;
