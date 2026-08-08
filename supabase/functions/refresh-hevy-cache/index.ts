// Refreshes public.hevy_cache with a summary of the most recent Hevy workout
// (date + total training volume). Invoked by Hevy's own webhook ("notify on
// new workout") rather than a schedule, since Hevy pushes on save instead of
// exposing a public feed like Letterboxd/Goodreads. The webhook payload only
// carries the workout id, so this fetches the full workout from the Hevy API
// (a Hevy Pro feature) with HEVY_API_KEY before caching it.
//
// Hevy's webhooks aren't signed (no Stripe-style signature header), so this
// is deployed with auth: 'none' + verify_jwt = false — Supabase's own JWT
// check would otherwise reject Hevy's request before this code ever runs.
// Instead, Hevy's webhook settings let you attach a custom Authorization
// header to every request it sends; the handler checks that against
// HEVY_WEBHOOK_SECRET. Because it always re-fetches the workout from Hevy's
// API under our own key rather than trusting the POST body, a forged
// request can at worst trigger a wasted API call — it can't inject
// arbitrary cache data.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

type HevySet = {
  type: "normal" | "warmup" | "dropset" | "failure";
  weight_kg: number | null;
  reps: number | null;
};

type HevyExercise = {
  sets: HevySet[];
};

type HevyWorkout = {
  id: string;
  title: string;
  start_time: string;
  exercises: HevyExercise[];
};

type HevyWebhookPayload = {
  payload: { workoutId: string };
};

// Training volume = weight x reps across working sets. Warmup sets are
// excluded, matching how lifters usually talk about "volume".
function totalVolumeKg(workout: HevyWorkout): number {
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

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const webhookSecret = Deno.env.get("HEVY_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!webhookSecret || providedSecret !== webhookSecret) {
      return Response.json({ ok: false, error: "invalid or missing authorization header" }, { status: 401 });
    }

    const apiKey = Deno.env.get("HEVY_API_KEY");
    if (!apiKey) {
      return Response.json({ ok: false, error: "HEVY_API_KEY is not set" }, { status: 500 });
    }

    try {
      const { payload } = (await req.json()) as HevyWebhookPayload;
      const workoutId = payload?.workoutId;
      if (!workoutId) throw new Error("webhook payload missing payload.workoutId");

      const res = await fetch(`https://api.hevyapp.com/v1/workouts/${workoutId}`, {
        headers: { "api-key": apiKey, Accept: "application/json" },
      });
      const body = await res.text();
      if (!res.ok) throw new Error(`fetch failed, status=${res.status}, body[0:200]=${body.slice(0, 200)}`);

      const workout = JSON.parse(body) as HevyWorkout;

      const { error: deleteError } = await ctx.supabaseAdmin.from("hevy_cache").delete().not("id", "is", null);
      if (deleteError) throw deleteError;

      const { error: insertError } = await ctx.supabaseAdmin.from("hevy_cache").insert({
        workout_id: workout.id,
        title: workout.title,
        performed_at: workout.start_time,
        total_volume_kg: totalVolumeKg(workout),
      });
      if (insertError) throw insertError;

      return Response.json({ ok: true });
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }),
};
