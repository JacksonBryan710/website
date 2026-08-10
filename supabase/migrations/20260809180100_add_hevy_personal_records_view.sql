-- Best-ever set per exercise (all-time PR), backing the Personal Records
-- widget. A view because PostgREST has no per-group top-N primitive --
-- without it, the client would have to fetch every set ever logged
-- (unbounded, grows every workout) just to reduce ~5 rows in JS.
-- security_invoker so the view is evaluated under the querying role (and
-- thus still governed by hevy_sets' own RLS policy) rather than the
-- view owner's privileges.
create view public.hevy_personal_records
with (security_invoker = true) as
select distinct on (exercise_template_id)
    exercise_template_id,
    exercise_title,
    weight_kg,
    reps,
    performed_at
from public.hevy_sets
where set_type = 'normal' and weight_kg is not null and reps is not null
order by exercise_template_id, weight_kg desc, reps desc;

grant select on public.hevy_personal_records to anon, authenticated;
