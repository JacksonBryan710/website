// Shared Hevy API types + helpers used by both sync-hevy-workout (per-
// workout, real-time webhook) and sync-hevy-history (historical backfill +
// periodic reconciliation). Field names verified against Hevy's public
// OpenAPI spec (https://api.hevyapp.com/docs) as of implementation time --
// Hevy warns their API is unstable ("we make no guarantees that we won't
// completely change the structure"), so a schema surprise here wouldn't be
// the first one (cf. the webhook body shape fix in commit ae18c9f).

export type HevySetType = "normal" | "warmup" | "dropset" | "failure";

export type HevySet = {
  index: number;
  type: HevySetType;
  weight_kg: number | null;
  reps: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  exercise_template_id: string;
  sets: HevySet[];
};

export type HevyWorkout = {
  id: string;
  title: string;
  routine_id: string | null;
  start_time: string;
  end_time: string | null;
  exercises: HevyExercise[];
};

export type HevyExerciseTemplate = {
  id: string;
  title: string;
  primary_muscle_group: string;
};

type WorkoutsPage = { page: number; page_count: number; workouts: HevyWorkout[] };
type ExerciseTemplatesPage = { page: number; page_count: number; exercise_templates: HevyExerciseTemplate[] };
export type HevyWorkoutEvent =
  | { type: "updated"; workout: HevyWorkout }
  | { type: "deleted"; id: string; deleted_at: string };
type WorkoutEventsPage = { page: number; page_count: number; events: HevyWorkoutEvent[] };

const HEVY_API_BASE = "https://api.hevyapp.com/v1";

async function hevyFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${HEVY_API_BASE}${path}`, {
    headers: { "api-key": apiKey, Accept: "application/json" },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Hevy API ${path} failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);
  }
  return JSON.parse(body) as T;
}

export function fetchWorkout(apiKey: string, workoutId: string): Promise<HevyWorkout> {
  return hevyFetch<HevyWorkout>(`/workouts/${workoutId}`, apiKey);
}

// Max pageSize for /v1/workouts is 10 per Hevy's docs.
export function fetchWorkoutsPage(apiKey: string, page: number, pageSize = 10): Promise<WorkoutsPage> {
  return hevyFetch<WorkoutsPage>(`/workouts?page=${page}&pageSize=${pageSize}`, apiKey);
}

// Purpose-built by Hevy for incremental sync ("allow clients to keep their
// local cache of workouts up to date without having to fetch the entire
// list") -- used by sync-hevy-history's cheap daily reconciliation runs
// instead of re-paginating /v1/workouts from the top every time.
export function fetchWorkoutEventsPage(
  apiKey: string,
  since: string,
  page: number,
  pageSize = 10,
): Promise<WorkoutEventsPage> {
  return hevyFetch<WorkoutEventsPage>(
    `/workouts/events?since=${encodeURIComponent(since)}&page=${page}&pageSize=${pageSize}`,
    apiKey,
  );
}

// Max pageSize for /v1/exercise_templates is 100 per Hevy's docs.
export function fetchExerciseTemplatesPage(
  apiKey: string,
  page: number,
  pageSize = 100,
): Promise<ExerciseTemplatesPage> {
  return hevyFetch<ExerciseTemplatesPage>(`/exercise_templates?page=${page}&pageSize=${pageSize}`, apiKey);
}

// Training volume = weight x reps across working sets. Warmup sets are
// excluded, matching how lifters usually talk about "volume".
export function totalVolumeKg(workout: HevyWorkout): number {
  let total = 0;
  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (set.type === "warmup") continue;
      if (set.weight_kg == null || set.reps == null) continue;
      total += set.weight_kg * set.reps;
    }
  }
  return total;
}

export function durationSeconds(workout: HevyWorkout): number | null {
  if (!workout.end_time) return null;
  const seconds = (new Date(workout.end_time).getTime() - new Date(workout.start_time).getTime()) / 1000;
  return seconds > 0 ? Math.round(seconds) : null;
}

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

// Upserts one workout (by workout_id) and replaces its sets wholesale.
// Hevy sets have no stable id to upsert against individually, so a
// full-batch replace of this workout's rows is the simplest way to stay
// idempotent on rerun -- mirrors the delete-then-insert idiom both existing
// Edge Functions (refresh-feed-cache, the old refresh-hevy-cache) already
// use, but insert-then-delete-others rather than delete-then-insert: if
// Hevy redelivers the same webhook and two calls for the same workout_id
// interleave, whichever call's delete runs last removes the other call's
// rows too (they're not in *its* just-inserted id list), converging on one
// clean batch instead of a duplicated one. If a concurrent "deleted" event
// (via deleteWorkout, e.g. from sync-hevy-history's reconcile) removes the
// parent hevy_workouts row in between, the sets insert fails its foreign
// key (Postgres 23503) -- treated as the workout no longer existing rather
// than a hard error, since inserting orphan sets for it would be moot.
export async function upsertWorkout(supabaseAdmin: SupabaseAdmin, workout: HevyWorkout) {
  const { error: workoutError } = await supabaseAdmin.from("hevy_workouts").upsert(
    {
      workout_id: workout.id,
      title: workout.title,
      routine_id: workout.routine_id,
      started_at: workout.start_time,
      ended_at: workout.end_time,
      duration_seconds: durationSeconds(workout),
      exercise_count: workout.exercises.length,
      total_volume_kg: totalVolumeKg(workout),
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "workout_id" },
  );
  if (workoutError) throw workoutError;

  const rows = workout.exercises.flatMap((exercise) =>
    exercise.sets.map((set) => ({
      workout_id: workout.id,
      performed_at: workout.start_time,
      exercise_template_id: exercise.exercise_template_id,
      exercise_title: exercise.title,
      set_index: set.index,
      set_type: set.type,
      weight_kg: set.weight_kg,
      reps: set.reps,
    }))
  );

  if (rows.length === 0) {
    const { error: deleteError } = await supabaseAdmin.from("hevy_sets").delete().eq("workout_id", workout.id);
    if (deleteError) throw deleteError;
    return;
  }

  const { data: inserted, error: setsError } = await supabaseAdmin.from("hevy_sets").insert(rows).select("id");
  if (setsError) {
    if (setsError.code === "23503") return;
    throw setsError;
  }

  const insertedIds = (inserted as { id: string }[]).map((row) => row.id);
  const { error: deleteError } = await supabaseAdmin
    .from("hevy_sets")
    .delete()
    .eq("workout_id", workout.id)
    .not("id", "in", `(${insertedIds.join(",")})`);
  if (deleteError) throw deleteError;
}

// hevy_sets cascades on delete via its workout_id FK, so removing the
// workout row is enough to clean up its sets too.
export async function deleteWorkout(supabaseAdmin: SupabaseAdmin, workoutId: string) {
  const { error } = await supabaseAdmin.from("hevy_workouts").delete().eq("workout_id", workoutId);
  if (error) throw error;
}

export async function upsertExerciseTemplates(supabaseAdmin: SupabaseAdmin, templates: HevyExerciseTemplate[]) {
  if (templates.length === 0) return;
  const fetchedAt = new Date().toISOString();
  const { error } = await supabaseAdmin.from("hevy_exercise_templates").upsert(
    templates.map((t) => ({
      id: t.id,
      title: t.title,
      primary_muscle_group: t.primary_muscle_group,
      fetched_at: fetchedAt,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}
