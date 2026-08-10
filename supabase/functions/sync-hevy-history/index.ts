// Fills in what the real-time sync-hevy-workout webhook can't: Hevy's
// exercise-template catalog (muscle groups, for the Muscle Split widget)
// and historical workout data (for Streak/Frequency/Personal
// Records/Duration Trend). Two modes, both idempotent:
//
//   ?mode=full&days=N  — one-time/rare backfill. Paginates the plain
//     /v1/workouts list (sort order undocumented, so this walks pages up
//     to a safety cap rather than assuming newest-first) and upserts every
//     workout started within the last N days.
//   (default)          — cheap periodic reconciliation, meant to run daily
//     via Supabase Cron (set up manually in the dashboard — there is no
//     in-repo cron config for refresh-feed-cache either, confirmed by
//     grepping this repo's migrations/config). Uses
//     /v1/workouts/events?since=, an endpoint Hevy built specifically "to
//     allow clients to keep their local cache of workouts up to date
//     without having to fetch the entire list" — a safety net for any
//     webhook call that never arrived.
//
// Not a public webhook — invoked with the project's own secret key, same
// pattern as refresh-feed-cache.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import {
  deleteWorkout,
  fetchExerciseTemplatesPage,
  fetchWorkoutEventsPage,
  fetchWorkoutsPage,
  upsertExerciseTemplates,
  upsertWorkout,
} from "../_shared/hevy.ts";

const FULL_BACKFILL_MAX_PAGES = 150; // 150 * 10 = 1,500 workouts, generous for a personal lifter
const EVENTS_MAX_PAGES = 20; // 20 * 10 = 200 events, generous for a short reconciliation window
const TEMPLATES_MAX_PAGES = 50; // 50 * 100 = 5,000 templates, generous for Hevy's ~450-item catalog

async function syncExerciseTemplates(supabaseAdmin: unknown, apiKey: string): Promise<number> {
  let page = 1;
  let pageCount = 1;
  let synced = 0;
  do {
    const result = await fetchExerciseTemplatesPage(apiKey, page);
    pageCount = result.page_count;
    await upsertExerciseTemplates(supabaseAdmin, result.exercise_templates);
    synced += result.exercise_templates.length;
    page += 1;
  } while (page <= pageCount && page <= TEMPLATES_MAX_PAGES);
  return synced;
}

async function syncFull(
  supabaseAdmin: unknown,
  apiKey: string,
  days: number,
  errors: Record<string, string>,
): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let page = 1;
  let pageCount = 1;
  let synced = 0;
  do {
    let result;
    try {
      result = await fetchWorkoutsPage(apiKey, page);
    } catch (err) {
      errors[`page_${page}`] = err instanceof Error ? err.message : String(err);
      break;
    }
    pageCount = result.page_count;
    for (const workout of result.workouts) {
      if (new Date(workout.start_time) < cutoff) continue;
      try {
        await upsertWorkout(supabaseAdmin, workout);
        synced += 1;
      } catch (err) {
        errors[workout.id] = err instanceof Error ? err.message : String(err);
      }
    }
    page += 1;
  } while (page <= pageCount && page <= FULL_BACKFILL_MAX_PAGES);
  return synced;
}

async function syncReconcile(
  supabaseAdmin: unknown,
  apiKey: string,
  days: number,
  errors: Record<string, string>,
): Promise<{ synced: number; deleted: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let page = 1;
  let pageCount = 1;
  let synced = 0;
  let deleted = 0;
  do {
    let result;
    try {
      result = await fetchWorkoutEventsPage(apiKey, since, page);
    } catch (err) {
      errors[`page_${page}`] = err instanceof Error ? err.message : String(err);
      break;
    }
    pageCount = result.page_count;
    for (const event of result.events) {
      try {
        if (event.type === "updated") {
          await upsertWorkout(supabaseAdmin, event.workout);
          synced += 1;
        } else {
          await deleteWorkout(supabaseAdmin, event.id);
          deleted += 1;
        }
      } catch (err) {
        const key = event.type === "updated" ? event.workout.id : event.id;
        errors[key] = err instanceof Error ? err.message : String(err);
      }
    }
    page += 1;
  } while (page <= pageCount && page <= EVENTS_MAX_PAGES);
  return { synced, deleted };
}

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (req, ctx) => {
    const apiKey = Deno.env.get("HEVY_API_KEY");
    if (!apiKey) {
      console.error("HEVY_API_KEY is not set");
      return Response.json({ ok: false, error: "HEVY_API_KEY is not set" }, { status: 500 });
    }

    const url = new URL(req.url);
    const isFull = url.searchParams.get("mode") === "full";
    const daysParam = url.searchParams.get("days");
    const parsedDays = daysParam === null ? NaN : Number(daysParam);
    const days = Number.isFinite(parsedDays) ? parsedDays : (isFull ? 400 : 3);
    const errors: Record<string, string> = {};

    try {
      // Isolated from the workout sync below: a broken exercise-templates
      // page shouldn't take down the day's webhook-reconciliation safety
      // net, which is this function's main job.
      let exerciseTemplatesSynced = 0;
      try {
        exerciseTemplatesSynced = await syncExerciseTemplates(ctx.supabaseAdmin, apiKey);
      } catch (err) {
        errors["exercise_templates"] = err instanceof Error ? err.message : String(err);
      }

      if (isFull) {
        const workoutsSynced = await syncFull(ctx.supabaseAdmin, apiKey, days, errors);
        return Response.json({
          ok: Object.keys(errors).length === 0,
          mode: "full",
          days,
          exerciseTemplatesSynced,
          workoutsSynced,
          errors,
        });
      }

      const { synced, deleted } = await syncReconcile(ctx.supabaseAdmin, apiKey, days, errors);
      return Response.json({
        ok: Object.keys(errors).length === 0,
        mode: "reconcile",
        days,
        exerciseTemplatesSynced,
        workoutsSynced: synced,
        workoutsDeleted: deleted,
        errors,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(message);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }),
};
