# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/` (requires `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars — see `.env.example`)
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run preview` — serve the production build locally

Database schema changes go in `supabase/migrations/*.sql` (raw, timestamp-prefixed SQL, applied via the Supabase CLI — `supabase` is a devDependency). Edge Functions (`supabase/functions/{refresh-feed-cache,sync-hevy-workout,sync-hevy-history,refresh-spotify-cache}/`) are Deno/TypeScript — the two Hevy functions share API types/helpers via `supabase/functions/_shared/hevy.ts` — deployed via `supabase functions deploy <name>`.

## Workflow

Each activity (feature, fix, chore) gets its own branch off `dev`, e.g. `add-photography-page`; PR that branch into `dev`. Periodically, `dev` → `main` via PR; pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. `.github/workflows/ci.yml` runs lint + build on every PR — keep this passing before merging. `.coderabbit.yaml` adds automated PR review (CodeRabbit) with extra scrutiny on RLS/grants in `supabase/migrations/`.

Within a branch, commit at each coherent checkpoint (e.g. schema, then Edge Function, then UI, then a review-feedback fix) rather than saving it all for one commit at the end — checkpoints cost nothing since CI only runs when the PR opens, and they give you a rollback point if a later step breaks something. Before merging, squash or reword so the branch lands in `dev` as one commit (or a small number of clearly-scoped ones) with a message that explains *why*, not just *what* — that's what keeps `dev`/`main` history readable.

## Architecture

**Frontend** — Vite + React 19, client-side routed with `react-router-dom` (`BrowserRouter`). `src/App.jsx` defines all routes under a single `Layout` (`src/components/Layout/`, just `Nav` + `<Outlet />`); `/` redirects to `/about`. Pages (`src/pages/{About,Now,Projects,Cooking,Training}/`) are each a component + colocated CSS file, no shared page-level state or layout variants. `Training` is the one exception to "just a page file": it composes six small stat-widget components (`src/components/Hevy{Streak,LatestLift,Frequency,MuscleSplit,PersonalRecords,DurationTrend}/`), each independently data-fetching, sharing only a presentational wrapper (`src/components/HevyPanel/`) for the retro panel chrome.

Because GitHub Pages can't do server-side rewrites, direct loads/refreshes of a client-side route (e.g. `/cooking`) would normally 404. `public/404.html` encodes the requested path into a query string and redirects to `/`, where the inline script in `index.html` decodes it via `history.replaceState` before React Router mounts (the [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) trick).

**Data layer** — One Supabase client (`src/lib/supabaseClient.js`), one shared hook (`src/lib/useSupabaseQuery.js`) that wraps any query-builder call with loading/error state and cancels on unmount. Pages/components call it directly, e.g. `useSupabaseQuery((supabase) => supabase.from('recipes').select('*'), [])` — there's no separate data/service layer.

**Backend (Supabase Postgres)** — Base schema in `supabase/migrations/20260808020413_init.sql`:
- `projects`, `recipes` — admin-authored content, public read.
- `feed_cache` — a machine-written cache of Letterboxd/Goodreads activity (see below), public read.

The Hevy (workout tracking) integration adds, in `supabase/migrations/20260809*`:
- `hevy_workouts`, `hevy_sets` — append-only workout history (one row per workout, one row per logged set), public read. Powers the Training page's Streak/Frequency/Duration Trend widgets.
- `hevy_exercise_templates` — a cache of Hevy's exercise-to-muscle-group catalog. No FK from `hevy_sets.exercise_template_id` to this table on purpose: a live webhook insert for a brand-new exercise can arrive before the catalog sync has cached it, and a hard FK would fail the whole workout on that race. Unmapped ids fall back to "Other" in the Muscle Split widget until the next sync fills them in.
- `hevy_personal_records` — a view over `hevy_sets` (best set ever per exercise); exists because PostgREST has no per-group top-N query primitive.
- `hevy_cache` (the original single-row cache from `20260808201711_add_hevy_cache.sql`) is superseded by `hevy_workouts`/`hevy_sets` and no longer read or written anywhere as of the Training page migration — left in place pending its own future drop-table migration, not a live comparison reference.

RLS is enabled on every table. **Public roles currently have read-only access everywhere** — the `authenticated` write policies on `projects`/`recipes` were deliberately revoked in `20260808032052_revoke_authenticated_write_until_admin_auth.sql` because they granted blanket `using (true)` write access with no real admin-auth check yet. Don't re-add broad authenticated write policies without an actual admin identity behind them; that migration's comment explains the intended follow-up.

The `refresh-feed-cache` Edge Function is scheduled (Supabase Cron), not user-triggered — it only accepts the project's secret key. It fetches the Letterboxd diary RSS feed and two Goodreads shelf RSS feeds directly, parses them, and rewrites `feed_cache` using the `service_role` key, which bypasses RLS. `service_role` grants in migrations exist specifically to support this.

Two Edge Functions maintain the Hevy tables:
- `sync-hevy-workout` (renamed from `refresh-hevy-cache`, which wrote to the now-retired `hevy_cache` table; Hevy's own webhook settings point at this URL) — a public webhook (`auth: 'none'`, `verify_jwt = false`) Hevy calls on every new workout. Hevy can't send Supabase credentials, so it's authenticated by a shared secret (`HEVY_WEBHOOK_SECRET`) checked against the request's `Authorization` header instead; the webhook body is untrusted (`{"workoutId": "..."}` only) and the function re-fetches the full workout from Hevy's API (`HEVY_API_KEY`) before writing anything.
- `sync-hevy-history` — backfills/reconciles workout history and the exercise-template catalog. Scheduled daily via a `pg_cron` + `pg_net` job defined in `supabase/migrations/20260809190000_add_sync_hevy_history_cron.sql` (the same `net.http_post`-with-`apikey`-header pattern `refresh-feed-cache`'s cron job uses, just version-controlled here instead of set up by hand in the dashboard); also invokable manually with `?mode=full&days=N` for a one-time historical backfill.

`HEVY_API_KEY` and `HEVY_WEBHOOK_SECRET` are Edge Function secrets (`supabase secrets set HEVY_API_KEY=... HEVY_WEBHOOK_SECRET=...`), not client env vars — they intentionally aren't in `.env.example`, which only covers `VITE_`-prefixed vars baked into the client bundle at build time. The `sync-hevy-history` cron job authenticates the same way: it reads a Supabase Vault secret (`refresh_feed_cache_secret_key`) and sends it as the `apikey` header — reused rather than duplicated under a new name, since that header is checked by the project's Edge Function gateway as a whole, not per-function.

The Spotify integration (Now page's "Top songs last month"/"Top artists last month" panels) adds `spotify_top_tracks`/`spotify_top_artists` in `supabase/migrations/20260811015250_add_spotify_top_tracks_and_artists.sql` — ranked snapshot tables (rank/title/image/external link/popularity, `time_range` scoped to Spotify's own `short_term` ≈ 4-week window since Spotify has no calendar-month concept), public read, machine-written by the `refresh-spotify-cache` Edge Function via delete-then-insert, same idiom as `refresh-feed-cache`. Deliberately two tables rather than folded into `feed_cache` or a single `item_type`-discriminated table: tracks and artists would otherwise share one column (artist names vs. genres) with two unrelated meanings, unlike `feed_cache.subtitle`, which stays one consistent meaning across its sources.

Unlike every other integration here, `refresh-spotify-cache` authenticates to Spotify as a specific *user* — `GET /me/top/{type}` requires OAuth `user-top-read` scope, not an app-level API key. A refresh token is obtained once via a manual browser consent flow (Spotify Developer Dashboard app + `/authorize` redirect + one-time code exchange) and stored as `SPOTIFY_REFRESH_TOKEN`; the function exchanges it for a short-lived access token on every run. `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`/`SPOTIFY_REFRESH_TOKEN` are Edge Function secrets, same reasoning as the Hevy ones above. Scheduled monthly, on the 1st, via `supabase/migrations/20260811022814_reschedule_refresh_spotify_cache_monthly.sql` (originally daily — rescheduled so the panels show a stable "last month," not a number that drifts underneath a fixed label every day), reusing the same `refresh_feed_cache_secret_key` Vault secret as every other cron job.

`SpotifyTopList` (`src/components/SpotifyTopList/`) is the first component in this repo rendering `<img>` (album art / artist photos) — it needs an explicit fallback for both a null `image_url` and a stale/404ing CDN URL, since neither `feed_cache` nor the Hevy widgets ever needed image handling. `SpotifyTopTracks`/`SpotifyTopArtists` are thin wrappers around it (`table`/`subtitleField` props), mirroring how `LetterboxdActivity`/`GoodreadsActivity` wrap `FeedActivity`.
