// Ingests one Hevy workout into public.hevy_workouts/hevy_sets. Invoked by
// Hevy's own webhook ("notify on new workout") rather than a schedule,
// since Hevy pushes on save instead of exposing a public feed like
// Letterboxd/Goodreads. The webhook body is just {"workoutId": "..."} —
// confirmed by logging a real payload, since existing write-ups describe a
// differently nested shape — so this fetches the full workout from the
// Hevy API (a Hevy Pro feature) with HEVY_API_KEY before storing it.
//
// Renamed from refresh-hevy-cache (which wrote to a since-retired
// single-row hevy_cache table) to match sync-hevy-history's naming --
// Hevy's own webhook settings now point at this URL directly.
//
// Hevy's webhooks aren't signed (no Stripe-style signature header), so this
// is deployed with auth: 'none' + verify_jwt = false — Supabase's own JWT
// check would otherwise reject Hevy's request before this code ever runs.
// Instead, Hevy's webhook settings let you attach a custom Authorization
// header to every request it sends; the handler checks that against
// HEVY_WEBHOOK_SECRET. Because it always re-fetches the workout from Hevy's
// API under our own key rather than trusting the POST body, a forged
// request can at worst trigger a wasted API call — it can't inject
// arbitrary data.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { fetchWorkout, upsertWorkout } from "../_shared/hevy.ts";

type HevyWebhookPayload = {
  workoutId: string;
};

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    const webhookSecret = Deno.env.get("HEVY_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!webhookSecret || providedSecret !== webhookSecret) {
      return Response.json({ ok: false, error: "invalid or missing authorization header" }, { status: 401 });
    }

    const apiKey = Deno.env.get("HEVY_API_KEY");
    if (!apiKey) {
      console.error("HEVY_API_KEY is not set");
      return Response.json({ ok: false, error: "HEVY_API_KEY is not set" }, { status: 500 });
    }

    try {
      const { workoutId } = (await req.json()) as HevyWebhookPayload;
      if (!workoutId) throw new Error("webhook payload missing workoutId");

      const workout = await fetchWorkout(apiKey, workoutId);
      await upsertWorkout(ctx.supabaseAdmin, workout);

      return Response.json({ ok: true });
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
      console.error(message);
      return Response.json({ ok: false, error: message }, { status: 500 });
    }
  }),
};
