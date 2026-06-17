<div align="center">

# 🍴 NomNom

### Chat about the food you're eating.

Upload a photo of your meal → get an **FDA-style Nutrition Facts label** → have a **smooth, streaming conversation** about it.

Built with **Next.js (App Router)** · **Vercel AI SDK** · **OpenAI GPT-4o** · **Supabase**

</div>

---

## Table of contents

- [What it does](#what-it-does)
- [Demo flow](#demo-flow)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [1. Install](#1-install)
  - [2. Environment variables](#2-environment-variables)
  - [3. Database](#3-database)
  - [4. Run](#4-run)
- [Configuration](#configuration)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Weekly commit analysis](#-weekly-commit-analysis-npm-run-analyze)
- [Design decisions](#design-decisions)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## What it does

1. **📷 Upload a photo** of any meal (drag-and-drop, file picker, or phone camera).
2. **🏷️ Get a Nutrition Facts label** — GPT-4o vision identifies the dish and estimates a per-serving nutrition profile, rendered as a faithful FDA-style label. **% Daily Values are computed in code** from official FDA reference values, not by the model, so the math is always consistent.
3. **💬 Chat about it** — a streaming assistant ("NomNom") answers questions grounded in the photo and the nutrition estimate: ingredients, healthier swaps, portion sizing, how it fits your day. Quick-reply chips seed the conversation and keep it feeling natural.
4. **💾 Everything persists** — chats, messages, and images are stored in Supabase, so refreshing the page restores your session.

---

## Demo flow

```
┌─────────────┐   upload    ┌──────────────┐   GPT-4o vision   ┌──────────────────┐
│   Browser   │ ──────────▶ │ /api/upload  │ ────────────────▶ │ Supabase Storage │
│  (page.tsx) │             │              │                   │   + chats row    │
└─────────────┘             └──────────────┘                   └──────────────────┘
       │                                                                 
       │  analyze                ┌───────────────┐   generateObject (Zod)
       ├───────────────────────▶ │ /api/analyze  │ ─────▶ structured Nutrition ─▶ chats.nutrition
       │                         └───────────────┘
       │
       │  chat (streaming)       ┌────────────┐   streamText, grounded in
       └───────────────────────▶ │ /api/chat  │ ─────▶ food + nutrition + photo ─▶ messages
                                 └────────────┘
```

---

## Architecture

- **Frontend** — a single client page ([`app/page.tsx`](app/page.tsx)) orchestrates three states: `idle` (uploader) → `uploading`/`analyzing` (spinner + preview) → `ready` (label + chat). Session id is kept in `localStorage` so refreshes restore history.
- **Vision → structured data** — [`/api/analyze`](app/api/analyze/route.ts) uses the AI SDK's `generateObject` with a Zod schema ([`lib/nutritionSchema.ts`](lib/nutritionSchema.ts)). The model returns **amounts only**; the label component derives **% Daily Value** deterministically.
- **Grounded streaming chat** — [`/api/chat`](app/api/chat/route.ts) loads the chat's food context, builds a system prompt augmented with the nutrition JSON, re-attaches the photo each turn (so the model keeps "seeing" the food), and streams the reply with `streamText`.
- **Server-only data layer** — the browser never talks to Supabase. All reads/writes go through a lazily-initialised service-role client ([`lib/supabase.ts`](lib/supabase.ts)). Row-Level Security stays **on with no public policies** — access is only possible server-side.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, TypeScript) |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`) + OpenAI GPT-4o |
| Validation | Zod (structured nutrition output) |
| Database / Storage | Supabase (Postgres + Storage) |
| Styling | Tailwind CSS |
| Tooling | `tsx` (runs the commit-analysis script) |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | ✅ | OpenAI key with available quota (vision + chat). |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (pre-filled for the FoodApp project). |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase **service_role** key — Dashboard → Project Settings → API. Server-only; never exposed to the browser. |
| `CHAT_MODEL` | — | Model id. Default `gpt-4o`. |
| `CHAT_TEMPERATURE` | — | Sampling temperature. Default `0.7`. |
| `CHAT_MAX_TOKENS` | — | Max reply tokens. Default `1024`. |
| `SYSTEM_PROMPT` | — | Override the assistant persona entirely. |
| `WAKATIME_API_KEY` | — | Enables measured hours in the analysis script. |
| `ANALYZE_DAYS` / `ANALYZE_AUTHOR` | — | Override the analysis window / author. |

### 3. Database

The schema is already applied to the connected Supabase project. For a fresh project, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the Supabase **SQL Editor**. It creates:

- `chats` and `messages` tables (RLS enabled, no public policies)
- a public `food-images` storage bucket

### 4. Run

```bash
npm run dev      # http://localhost:3000
```

Upload a meal photo → see the label → start chatting.

Other scripts:

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # next lint
npm run analyze  # weekly commit analysis (see below)
```

---

## Configuration

Everything that shapes the model's behaviour lives in the environment (see [`lib/config.ts`](lib/config.ts)) — no code changes needed:

```bash
CHAT_MODEL=gpt-4o
CHAT_TEMPERATURE=0.7
CHAT_MAX_TOKENS=1024
SYSTEM_PROMPT="You are a warm, knowledgeable food companion..."
```

`SYSTEM_PROMPT` only sets the **base persona** — at request time the server appends the dish name and nutrition JSON so answers stay grounded.

---

## Project structure

```
app/
  layout.tsx               root layout + metadata
  page.tsx                 upload → label → chat orchestration (client)
  globals.css              Tailwind + theme
  api/
    upload/route.ts        store image in Storage, create chat row
    analyze/route.ts       GPT-4o vision → structured nutrition
    chat/route.ts          streaming grounded chat (persists turns)
    chats/[id]/route.ts    restore a session (food + message history)
components/
  ImageUploader.tsx        drag/drop / camera uploader with preview
  NutritionLabel.tsx       FDA-style label; computes % Daily Value
  FoodChat.tsx             useChat streaming UI + quick replies
lib/
  config.ts                env-driven model + persona config
  supabase.ts              lazy server-only service-role client
  nutritionSchema.ts       Zod schema + FDA Daily Values + %DV helper
scripts/
  analyze-commits.ts       weekly code-quality + hours report
supabase/
  migrations/0001_init.sql schema + storage bucket
```

---

## API reference

| Route | Method | Body | Returns |
| --- | --- | --- | --- |
| `/api/upload` | POST | `multipart/form-data` with `file` | `{ chatId, imageUrl }` |
| `/api/analyze` | POST | `{ chatId, imageUrl }` | structured `Nutrition` object |
| `/api/chat` | POST | `{ chatId, messages }` | streamed assistant reply (AI SDK data stream) |
| `/api/chats/[id]` | GET | — | `{ chatId, imageUrl, foodName, nutrition, messages }` |

---

## Data model

```sql
chats (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  image_url    text not null,
  food_name    text,
  nutrition    jsonb
)

messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid references chats(id) on delete cascade,
  role        text check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz default now()
)
```

RLS is enabled on both tables with **no public policies** — only the service-role key (server-side) can read or write.

---

## 📊 Weekly commit analysis (`npm run analyze`)

A standalone script ([`scripts/analyze-commits.ts`](scripts/analyze-commits.ts)) that **pulls the repo** and analyses **your commits over the past 7 days**.

```bash
npm run analyze
# or
npx tsx scripts/analyze-commits.ts
```

**What it measures**

- **Code quality** — GPT-4o reviews each commit's diff against a calibrated rubric (readability, structure, error handling, testing, commit message), producing per-commit scores and a **lines-weighted overall** score so large commits count proportionally.
- **Hours spent** — uses the **WakaTime API** (`WAKATIME_API_KEY`) for *measured* coding time. Without a key it **estimates** from git timestamps by grouping commits into sessions (≤120 min gaps) and adding 30 min of pre-commit work per session. The report always states which source was used.

**Output** — a console summary plus a `commit-analysis.md` file with per-commit breakdowns. Example:

```
════════════════════════════════════════════════════════════
  COMMIT ANALYSIS — past 7 days
════════════════════════════════════════════════════════════
  Commits:        1
  Lines:          +4460 / -0
  Hours:          8.1h  (WakaTime (measured))
  Lines/hour:     554
────────────────────────────────────────────────────────────
  Overall quality: 8.4/10  ████████░░
   readability    8.0  ████████░░
   structure      9.0  █████████░
   ...
════════════════════════════════════════════════════════════
```

**Tuning** — `ANALYZE_DAYS` (window), `ANALYZE_AUTHOR` (which author's commits), `CHAT_MODEL` (review model).

> If quality shows `n/a`, the OpenAI review calls failed — most often an exhausted `OPENAI_API_KEY` quota. Hours still report independently.

---

## Design decisions

- **% Daily Value is computed, not generated.** LLMs are unreliable at arithmetic, so the model returns only amounts and the label derives %DV from FDA reference values — accurate and consistent every time.
- **Photo re-attached every chat turn.** Keeping the image in context lets the assistant answer follow-ups about what it can *see* (garnishes, portion, plating), not just the nutrition numbers.
- **Server-only Supabase access.** No anon client in the browser; RLS locked down. Simpler and safer for an anonymous, no-login flow.
- **Lazy Supabase client.** The client is constructed on first use so `next build` (which imports route modules) doesn't require secrets to be present.
- **Anonymous sessions.** Identified by `chatId` in `localStorage`. Supabase Auth can be layered on later for per-user history.

---

## Deployment

Deploys cleanly to **Vercel**:

1. Import the repo into Vercel.
2. Add the environment variables from [§2](#2-environment-variables) (set `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret).
3. Deploy. Route handlers run on the Node.js runtime (`runtime = "nodejs"`).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing Supabase env vars` | Set `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. |
| `You exceeded your current quota` | The OpenAI account is out of credit — add billing/quota. |
| Upload fails | Confirm the `food-images` bucket exists and is public (re-run the migration). |
| Analysis finds 0 commits | Check `git config user.email` matches your commits, or set `ANALYZE_AUTHOR`. |
| Quality shows `n/a` | All review calls failed — usually OpenAI quota; hours are unaffected. |
