# 🍴 NomNom — Chat about the food you're eating

Upload a photo of your meal and NomNom will:

1. Generate an **FDA-style Nutrition Facts label** for it (powered by GPT-4o vision).
2. Open a **smooth, streaming conversation** about the food — ingredients, healthier swaps, how it fits your day.

Built with **Next.js (App Router)** + the **Vercel AI SDK** + **Supabase** (chats, messages, and images are persisted, so a refresh restores your session).

---

## Quick start

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in:

| Var | Where to get it |
| --- | --- |
| `OPENAI_API_KEY` | platform.openai.com |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API (already set to the FoodApp project) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** key |

Model behaviour is fully env-configurable: `CHAT_MODEL`, `CHAT_TEMPERATURE`, `CHAT_MAX_TOKENS`, and `SYSTEM_PROMPT`.

### 3. Database

The schema (tables `chats` + `messages`, plus the public `food-images` storage bucket) is already applied to the connected Supabase project. To set it up on a fresh project, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) in the Supabase **SQL Editor**.

### 4. Run

```bash
npm run dev
# open http://localhost:3000
```

Upload a food photo → see the nutrition label → start chatting.

---

## How it works

```
Browser ──upload──▶ /api/upload  ──▶ Supabase Storage + chats row
        ──analyze─▶ /api/analyze ──▶ GPT-4o vision → Zod-structured nutrition (generateObject)
        ──chat────▶ /api/chat    ──▶ GPT-4o streamText, grounded in food + nutrition context
```

- **Structured nutrition** — [`lib/nutritionSchema.ts`](lib/nutritionSchema.ts) defines the Zod schema; the model returns raw amounts and the label computes **% Daily Value** deterministically from FDA reference values, so the math is never hallucinated.
- **Grounded chat** — [`app/api/chat/route.ts`](app/api/chat/route.ts) injects the food name + nutrition JSON into the system prompt and re-attaches the photo each turn, then streams the reply via the AI SDK.
- **Server-only data access** — the browser never touches Supabase; all reads/writes go through the service-role client ([`lib/supabase.ts`](lib/supabase.ts)). RLS stays on with no public policies.

---

## 📊 Weekly commit analysis (`npm run analyze`)

A standalone script that pulls your repo and analyses **your commits over the past 7 days**:

```bash
npm run analyze
# or: npx tsx scripts/analyze-commits.ts
```

It reports:

- **Code quality** — GPT-4o reviews each commit's diff against a rubric (readability, structure, error handling, testing, commit message) and produces per-commit + weighted-overall scores.
- **Hours spent** — uses the **WakaTime API** (`WAKATIME_API_KEY`) for measured coding time. Without a key it **estimates** from git timestamps by grouping commits into sessions (≤120 min gaps) and adding 30 min of pre-commit work per session.

Output goes to the console and to `commit-analysis.md`. Tune with `ANALYZE_DAYS` and `ANALYZE_AUTHOR`.

---

## Project layout

```
app/
  page.tsx              upload → label → chat UI
  api/upload/           store image + create chat
  api/analyze/          GPT-4o vision → nutrition
  api/chat/             streaming grounded chat
  api/chats/[id]/       restore a session on refresh
components/             ImageUploader, NutritionLabel, FoodChat
lib/                    config (env), supabase client, nutrition schema
scripts/analyze-commits.ts   weekly commit-quality + hours report
supabase/migrations/    schema
```
