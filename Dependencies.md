---
title: CineMood — Dependencies
tags:
  - dep-hub
type: dependencies
related:
  - "[[cinemood/README]]"
---

# CineMood dependencies

| Package | Why |
|---|---|
| `next` 16 | App Router, server components, route handlers, ISR caching of TMDB calls |
| `react` / `react-dom` 19 | UI |
| `@supabase/supabase-js`, `@supabase/ssr` | Auth (email/password, magic link, OAuth), Postgres access with RLS, cookie sessions |
| `zod` | Validation of every API input and of AI JSON output |
| `server-only` | Build-time guard keeping secrets out of client bundles |
| `typescript`, `@types/*` | Types |
| `vitest` | Unit tests |

External services: **TMDB API** (data, images, reviews, JustWatch availability), **Supabase** (optional), **Ollama** (optional, local).
