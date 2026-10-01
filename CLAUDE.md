---
title: CineMood — CLAUDE
tags:
  - project-hub
  - claude-config
type: config
related:
  - "[[cinemood/README]]"
  - "[[INDEX]]"
---

# CineMood — bounded context for Claude

**What:** mood-first global movie discovery (Next.js 16 App Router, React 19, TS, Supabase, TMDB, Ollama).
**Read first:** `README.md` (architecture + setup). Master spec lives in the original prompt; this repo implements phases 1–4.

## Rules
- AI runs **locally via Ollama only** (vault directive). Never add cloud AI APIs.
- Never fabricate movie data, ratings, reviews, cast or availability. Missing TMDB key → `ConfigNotice`, not placeholders.
- Secrets are server-only: anything importing `lib/env.ts`, `lib/tmdb/client.ts`, `lib/db/supabase.ts` must stay out of client components.
- Moods are data (`moods` table / `lib/moods/taxonomy.ts` seed). Components get them from `useMoods()`; don't hard-code mood lists in components.
- Keep `lib/recommendations/engine.ts`, `lib/mood-engine/rules.ts`, `lib/search/query.ts` **pure** (no server-only imports) — they're unit-tested and used client-side.
- After changing the taxonomy/reference data run `npm run seed:generate`.

## Commands
| Task | Command |
|---|---|
| Dev | `npm run dev` |
| Type-check | `npm run lint` |
| Tests | `npm test` |
| Build | `npm run build` |

## Key files
- Pipeline: `lib/recommendations/service.ts` → `engine.ts`
- Mood profiles: `lib/mood-engine/rules.ts`, `classify.ts`
- NL search: `lib/search/query.ts` (rules), `interpret.ts` (Ollama)
- Library (watchlist/watched): `lib/library/store.ts`, synced by `components/library/LibrarySync.tsx`
- Schema/RLS: `supabase/migrations/0001_schema.sql`
