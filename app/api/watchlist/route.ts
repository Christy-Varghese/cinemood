import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/db/supabase";
import { badRequest, sameOrigin } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Cloud watchlist for signed-in users. Uses the user's own session client,
 * so Postgres RLS guarantees users can only touch their own rows.
 */
const Item = z.object({
  tmdbId: z.number().int().positive(),
  title: z.string().max(300),
  posterPath: z.string().max(200).nullable(),
  backdropPath: z.string().max(200).nullable().optional(),
  releaseDate: z.string().max(20).nullable(),
  originalLanguage: z.string().max(5),
  voteAverage: z.number().min(0).max(10),
  genreIds: z.array(z.number().int()).max(20),
  runtime: z.number().int().nullable().optional(),
  moods: z.array(z.string().max(20)).max(5).optional(),
  status: z.enum(["want", "watched"]),
  favorite: z.boolean(),
  myRating: z.number().int().min(1).max(5).nullable().optional(),
  addedAt: z.string(),
  watchedAt: z.string().nullable().optional(),
});

async function client() {
  const sb = await supabaseServer();
  if (!sb) return { sb: null, user: null };
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

export async function GET() {
  const { sb, user } = await client();
  if (!sb || !user) return NextResponse.json({ items: [], signedIn: false });
  const { data, error } = await sb.from("watchlists").select("tmdb_id, status, is_favorite, my_rating, snapshot, created_at, watched_at").order("created_at", { ascending: false });
  if (error) {
    logError("db", "watchlist read failed", error);
    return NextResponse.json({ items: [], signedIn: true });
  }
  const items = (data ?? []).map((r) => ({
    ...(r.snapshot as object),
    tmdbId: r.tmdb_id,
    status: r.status,
    favorite: r.is_favorite,
    myRating: r.my_rating,
    addedAt: r.created_at,
    watchedAt: r.watched_at,
  }));
  return NextResponse.json({ items, signedIn: true });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return badRequest();
  const { sb, user } = await client();
  if (!sb || !user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = Item.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest();
  const it = parsed.data;
  const { status, favorite, myRating, addedAt, watchedAt, tmdbId, ...snapshot } = it;
  const { error } = await sb.from("watchlists").upsert(
    {
      user_id: user.id,
      tmdb_id: tmdbId,
      status,
      is_favorite: favorite,
      my_rating: myRating ?? null,
      snapshot,
      created_at: addedAt,
      watched_at: watchedAt ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tmdb_id" },
  );
  if (error) {
    logError("db", "watchlist upsert failed", error);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
