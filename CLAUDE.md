# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build to `dist/` (requires `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars — see `.env.example`)
- `npm run lint` — ESLint (flat config in `eslint.config.js`)
- `npm run preview` — serve the production build locally

Database schema changes go in `supabase/migrations/*.sql` (raw, timestamp-prefixed SQL, applied via the Supabase CLI — `supabase` is a devDependency). The `refresh-feed-cache` Edge Function (`supabase/functions/refresh-feed-cache/`) is Deno/TypeScript and deployed via `supabase functions deploy refresh-feed-cache`.

## Workflow

Each activity (feature, fix, chore) gets its own branch off `dev`, e.g. `add-photography-page`; PR that branch into `dev`. Periodically, `dev` → `main` via PR; pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages. `.github/workflows/ci.yml` runs lint + build on every PR — keep this passing before merging. `.coderabbit.yaml` adds automated PR review (CodeRabbit) with extra scrutiny on RLS/grants in `supabase/migrations/`.

## Architecture

**Frontend** — Vite + React 19, client-side routed with `react-router-dom` (`BrowserRouter`). `src/App.jsx` defines all routes under a single `Layout` (`src/components/Layout/`, just `Nav` + `<Outlet />`); `/` redirects to `/about`. Pages (`src/pages/{About,Now,Projects,Cooking}/`) are each a component + colocated CSS file, no shared page-level state or layout variants.

Because GitHub Pages can't do server-side rewrites, direct loads/refreshes of a client-side route (e.g. `/cooking`) would normally 404. `public/404.html` encodes the requested path into a query string and redirects to `/`, where the inline script in `index.html` decodes it via `history.replaceState` before React Router mounts (the [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) trick).

**Data layer** — One Supabase client (`src/lib/supabaseClient.js`), one shared hook (`src/lib/useSupabaseQuery.js`) that wraps any query-builder call with loading/error state and cancels on unmount. Pages/components call it directly, e.g. `useSupabaseQuery((supabase) => supabase.from('recipes').select('*'), [])` — there's no separate data/service layer.

**Backend (Supabase Postgres)** — Three tables, schema in `supabase/migrations/20260808020413_init.sql`:
- `projects`, `recipes` — admin-authored content, public read.
- `feed_cache` — a machine-written cache of Letterboxd/Goodreads activity (see below), public read.

RLS is enabled on all three. **Public roles currently have read-only access everywhere** — the `authenticated` write policies on `projects`/`recipes` were deliberately revoked in `20260808032052_revoke_authenticated_write_until_admin_auth.sql` because they granted blanket `using (true)` write access with no real admin-auth check yet. Don't re-add broad authenticated write policies without an actual admin identity behind them; that migration's comment explains the intended follow-up.

The `refresh-feed-cache` Edge Function is scheduled (Supabase Cron), not user-triggered — it only accepts the project's secret key. It fetches the Letterboxd diary RSS feed and two Goodreads shelf RSS feeds directly, parses them, and rewrites `feed_cache` using the `service_role` key, which bypasses RLS. `service_role` grants in migrations exist specifically to support this.
