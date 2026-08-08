// Refreshes public.feed_cache from the Letterboxd diary RSS feed and the two
// Goodreads shelf RSS feeds. Fetches and parses the raw RSS XML directly
// (no third-party proxy) — api.rss2json.com's own Cloudflare protection was
// blocking Supabase's shared Edge Function IP range with a 403 challenge
// page, while the Letterboxd/Goodreads feeds themselves were unaffected.
// Meant to be invoked on a schedule (Supabase Cron) rather than by end
// users, so it only accepts the project's secret key, not the public key.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { XMLParser } from "fast-xml-parser";

const MAX_ENTRIES = 5;

const LETTERBOXD_USERNAME = "JackJack305";
const GOODREADS_USER_ID = "179944323";

// Cloudflare/anti-bot protection on these feeds cares about looking like a
// real browser request, not about authentication.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/xml, text/xml, */*;q=0.8",
};

const xmlParser = new XMLParser({ cdataPropName: "__cdata" });

type CachedEntry = {
  title: string;
  subtitle: string | null;
  rating: number | null;
  link: string;
  entry_key: string;
};

type FeedTarget = {
  source: "letterboxd" | "goodreads";
  feedKey: string;
  rssUrl: string;
  parse: (item: RssItem) => CachedEntry | null;
};

type RssItem = {
  guid?: string | { __cdata?: string };
  link: string | { __cdata?: string };
  title: string;
  description?: string | { __cdata?: string };
};

function textOf(value: string | { __cdata?: string } | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return value.__cdata ?? "";
}

function parseRssItems(xml: string): RssItem[] {
  const doc = xmlParser.parse(xml);
  const items = doc?.rss?.channel?.item;
  if (!items) return [];
  return Array.isArray(items) ? items : [items];
}

// Letterboxd diary RSS titles look like "Film Name, 2024 - ★★★½"
function parseDiaryEntry(item: RssItem): CachedEntry | null {
  const title = textOf(item.title);
  const match = title.match(/^(.+), (\d{4})(?: - (.+))?$/);
  if (!match) return null;

  const [, name, year, stars] = match;
  const rating = stars
    ? (stars.match(/★/g) || []).length + (stars.match(/½/g) || []).length * 0.5
    : null;

  const link = textOf(item.link);
  return {
    title: name,
    subtitle: year,
    rating,
    link,
    entry_key: textOf(item.guid) || link,
  };
}

// Goodreads' custom RSS fields show up in the description as
// "author: X<br> ... rating: Y<br> ...".
function parseShelfEntry(item: RssItem): CachedEntry | null {
  const description = textOf(item.description);
  const authorMatch = description.match(/author: ([^<]*)<br/);
  const ratingMatch = description.match(/rating: (\d+)<br/);
  const rating = ratingMatch ? Number(ratingMatch[1]) : 0;

  const link = textOf(item.link);
  return {
    title: textOf(item.title),
    subtitle: authorMatch ? authorMatch[1].trim() : null,
    rating: rating > 0 ? rating : null,
    link,
    entry_key: textOf(item.guid) || link,
  };
}

function feedTargets(): FeedTarget[] {
  return [
    {
      source: "letterboxd",
      feedKey: "diary",
      rssUrl: `https://letterboxd.com/${LETTERBOXD_USERNAME}/rss/`,
      parse: parseDiaryEntry,
    },
    {
      source: "goodreads",
      feedKey: "read",
      rssUrl: `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=read`,
      parse: parseShelfEntry,
    },
    {
      source: "goodreads",
      feedKey: "currently-reading",
      rssUrl: `https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=currently-reading`,
      parse: parseShelfEntry,
    },
  ];
}

export default {
  fetch: withSupabase({ auth: ["secret"] }, async (_req, ctx) => {
    const refreshed: string[] = [];
    const errors: Record<string, string> = {};

    for (const target of feedTargets()) {
      const label = `${target.source}/${target.feedKey}`;
      try {
        const res = await fetch(target.rssUrl, { headers: BROWSER_HEADERS });
        const xml = await res.text();
        if (!res.ok) throw new Error(`fetch failed, status=${res.status}, body[0:200]=${xml.slice(0, 200)}`);

        const entries = parseRssItems(xml)
          .slice(0, MAX_ENTRIES)
          .map(target.parse)
          .filter((entry): entry is CachedEntry => entry !== null);

        const { error: deleteError } = await ctx.supabaseAdmin
          .from("feed_cache")
          .delete()
          .eq("source", target.source)
          .eq("feed_key", target.feedKey);
        if (deleteError) throw deleteError;

        if (entries.length > 0) {
          const { error: insertError } = await ctx.supabaseAdmin.from("feed_cache").insert(
            entries.map((entry, index) => ({
              source: target.source,
              feed_key: target.feedKey,
              sort_order: index,
              title: entry.title,
              subtitle: entry.subtitle,
              rating: entry.rating,
              link: entry.link,
              entry_key: entry.entry_key,
            })),
          );
          if (insertError) throw insertError;
        }

        refreshed.push(label);
      } catch (err) {
        const message = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err);
        errors[label] = message;
      }
    }

    return Response.json({ ok: Object.keys(errors).length === 0, refreshed, errors });
  }),
};
