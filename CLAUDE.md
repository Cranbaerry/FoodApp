# CLAUDE.md

Guidance for Claude Code / AI agents working in this repository.

## What this is

**NomNom** — a Next.js (App Router) web app: upload a food photo → get an FDA-style
Nutrition Facts label (GPT-4o vision) → have a streaming, grounded chat about the food.
Persistence is Supabase. There's also a standalone `npm run analyze` script that reviews
the past week's git commits for code quality and hours.

## Commands

```bash
npm run dev       # local dev server (http://localhost:3000)
npm run build     # production build — run this to verify type-safety before committing
npm run start     # serve the production build
npm run lint      # next lint
npm run analyze   # weekly commit code-quality + hours report (scripts/analyze-commits.ts)
```

There is **no test suite**. Verification = `npm run build` (full TypeScript type-check) plus a
manual smoke test of the affected flow.

## Architecture (the load-bearing parts)

- **`app/page.tsx`** — the only page; a client component with a state machine:
  `idle → uploading → analyzing → ready`. Holds `chatId` in `localStorage` to restore sessions.
- **`app/api/upload/route.ts`** — multipart upload → Supabase Storage (`food-images`) → creates a `chats` row.
- **`app/api/analyze/route.ts`** — `generateObject` (GPT-4o vision) against the Zod schema in
  `lib/nutritionSchema.ts`; persists `nutrition` + `food_name` on the chat row.
- **`app/api/chat/route.ts`** — `streamText`; loads the chat's food context, builds a system prompt
  augmented with the nutrition JSON, **re-attaches the photo as the first message every turn**, and
  persists both the user turn and assistant reply to `messages`.
- **`app/api/chats/[id]/route.ts`** — GET; returns food context + full message history for session restore.
- **`lib/supabase.ts`** — server-only, **lazily-initialised** service-role client behind a `Proxy`.
- **`lib/nutritionSchema.ts`** — Zod schema + FDA `dailyValues` + `percentDV()` helper.
- **`lib/config.ts`** — all model/persona config, read from env.
- **`scripts/analyze-commits.ts`** — self-contained; has its own minimal `.env` loader.

## Conventions & invariants — keep these intact

- **The browser never touches Supabase.** All DB/storage access is server-side via the service-role
  client. RLS is on with **no public policies**; do not add client-side Supabase calls or public policies.
- **`lib/supabase.ts` must stay lazy.** It validates env on first *use*, not at import — otherwise
  `next build` (which imports route modules during page-data collection) fails without secrets.
  If you refactor it, preserve this.
- **% Daily Value is computed in code, never by the model.** The nutrition schema returns *amounts only*;
  `NutritionLabel.tsx` derives %DV from `dailyValues`. Don't ask the model for percentages.
- **Model behaviour is env-driven** (`CHAT_MODEL`, `CHAT_TEMPERATURE`, `CHAT_MAX_TOKENS`, `SYSTEM_PROMPT`).
  Don't hardcode these in routes — read them from `lib/config.ts`.
- **AI SDK version is v4** (`ai` ^4, `@ai-sdk/react` ^1). `useChat` uses `initialMessages`,
  `isLoading`, `append`, and string `content`. Don't port to v5 APIs without updating all call sites.
- **Route handlers use the Node.js runtime** (`export const runtime = "nodejs"`) because they use
  Buffer / `node:crypto` and the service-role client. Keep it.
- Match the existing style: TypeScript throughout, Tailwind classes, concise comments explaining *why*.

## Environment

Copy `.env.example` → `.env.local`. Required by the app: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. `npm run analyze` additionally **requires** `WAKATIME_API_KEY` (and
`OPENAI_API_KEY`) and exits early if either is missing. Optional: model tuning vars + `ANALYZE_*`.
Never commit `.env.local`; never expose the service-role key to client code.

## Database

Schema lives in `supabase/migrations/` (`0001_init.sql`: tables `chats`, `messages` + public
`food-images` bucket; `0002_grants.sql`: role grants + default privileges). Apply changes via **new**
migration files / the Supabase SQL editor — don't edit migrations after they're applied.

**Grants gotcha:** hand-written tables in `public` do NOT auto-get Supabase role grants, so
`service_role` (bypasses RLS but still needs table GRANTs) gets `permission denied for table`.
`0002_grants.sql` sets `ALTER DEFAULT PRIVILEGES ... FOR ROLE postgres` so future tables are granted
automatically — but if you create tables through some other path, re-check grants.

## Gotchas

- A failing code-quality review in `npm run analyze` is almost always an **OpenAI quota** issue, not a
  bug — the script degrades to `n/a` and still reports hours.
- Image URLs passed to the model must be reachable (the `food-images` bucket is public for this reason).
