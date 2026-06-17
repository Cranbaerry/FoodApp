#!/usr/bin/env -S npx tsx
/**
 * analyze-commits — pulls the repo, then analyses YOUR commits from the past 7
 * days for code quality (via GPT-4o) and time spent (via WakaTime, falling back
 * to a git-timestamp estimate).
 *
 *   npm run analyze
 *   npx tsx scripts/analyze-commits.ts
 *
 * Env (loaded from .env.local / .env):
 *   OPENAI_API_KEY   required — powers the code-quality review
 *   CHAT_MODEL       optional — defaults to gpt-4o
 *   WAKATIME_API_KEY optional — enables accurate hours; otherwise estimated from git
 *   ANALYZE_DAYS     optional — lookback window in days (default 7)
 *   ANALYZE_AUTHOR   optional — override the git author email to analyse
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Minimal .env loader (no dependency). Loads .env.local then .env.
// ---------------------------------------------------------------------------
function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const raw of readFileSync(path, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  }
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------
function git(args: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

function ensureRepo() {
  try {
    git("rev-parse --is-inside-work-tree");
  } catch {
    console.error("✖ Not inside a git repository. Run this from your project root.");
    process.exit(1);
  }
}

/** Sync with the remote so the analysis reflects what's on GitHub. */
function pull() {
  try {
    git("pull --ff-only");
    console.log("✔ Pulled latest from remote.");
  } catch {
    try {
      git("fetch --all --quiet");
      console.log("✔ Fetched latest from remote (fast-forward pull skipped).");
    } catch {
      console.log("• Skipped remote sync (no remote or offline).");
    }
  }
}

interface Commit {
  hash: string;
  date: string; // ISO author date
  subject: string;
  added: number;
  deleted: number;
  files: number;
  diff: string;
}

const SEP = "\x1f";

function collectCommits(days: number, author: string): Commit[] {
  const log = git(
    `log --no-merges --since="${days} days ago" --author="${author}" ` +
      `--pretty=format:%H${SEP}%aI${SEP}%s`,
  );
  if (!log) return [];

  const commits: Commit[] = [];
  for (const line of log.split("\n")) {
    const [hash, date, subject] = line.split(SEP);
    if (!hash) continue;

    // numstat: "added\tdeleted\tfile"
    let added = 0;
    let deleted = 0;
    let files = 0;
    const numstat = git(`show --numstat --format= ${hash}`);
    for (const row of numstat.split("\n")) {
      if (!row.trim()) continue;
      const [a, d] = row.split("\t");
      files += 1;
      added += Number.parseInt(a, 10) || 0;
      deleted += Number.parseInt(d, 10) || 0;
    }

    // Truncated patch keeps token cost bounded while preserving signal.
    let diff = git(`show --format= -p ${hash}`);
    if (diff.length > 6000) diff = diff.slice(0, 6000) + "\n…[diff truncated]…";

    commits.push({ hash, date, subject, added, deleted, files, diff });
  }
  return commits;
}

// ---------------------------------------------------------------------------
// Code-quality review (GPT-4o, structured)
// ---------------------------------------------------------------------------
const qualitySchema = z.object({
  readability: z.number().min(0).max(10).describe("Naming, clarity, comments where useful"),
  structure: z.number().min(0).max(10).describe("Cohesion, modularity, no needless duplication"),
  errorHandling: z.number().min(0).max(10).describe("Edge cases, validation, failure paths"),
  testing: z.number().min(0).max(10).describe("Presence/quality of tests; 5 if not applicable"),
  commitMessage: z.number().min(0).max(10).describe("How well the message explains the change"),
  overall: z.number().min(0).max(10),
  summary: z.string().describe("One sentence verdict"),
  strengths: z.array(z.string()).max(3),
  concerns: z.array(z.string()).max(3),
});

type Quality = z.infer<typeof qualitySchema>;

async function reviewCommit(model: string, c: Commit): Promise<Quality | null> {
  try {
    const { object } = await generateObject({
      model: openai(model),
      schema: qualitySchema,
      prompt:
        `You are a meticulous staff engineer reviewing a single git commit. Score each dimension 0-10 ` +
        `and be calibrated: 5 is average professional work, 8+ is excellent, below 4 is poor. ` +
        `Judge only what this diff changes.\n\n` +
        `Commit message: ${c.subject}\n` +
        `Files changed: ${c.files}, +${c.added}/-${c.deleted} lines\n\n` +
        `Diff:\n${c.diff}`,
    });
    return object;
  } catch (err) {
    console.error(`  ! Review failed for ${c.hash.slice(0, 7)}: ${(err as Error).message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hours: WakaTime (accurate) or git-timestamp sessionization (estimate)
// ---------------------------------------------------------------------------
async function wakatimeHours(days: number): Promise<number | null> {
  const key = process.env.WAKATIME_API_KEY;
  if (!key) return null;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const auth = Buffer.from(key).toString("base64");
  try {
    const res = await fetch(
      `https://wakatime.com/api/v1/users/current/summaries?start=${fmt(start)}&end=${fmt(end)}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (!res.ok) {
      console.error(`  ! WakaTime API returned ${res.status}; falling back to git estimate.`);
      return null;
    }
    const json = (await res.json()) as { data: { grand_total: { total_seconds: number } }[] };
    const seconds = json.data.reduce((sum, d) => sum + (d.grand_total?.total_seconds ?? 0), 0);
    return seconds / 3600;
  } catch (err) {
    console.error(`  ! WakaTime request failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Estimate hours by grouping commits into coding sessions. Commits within
 * GAP minutes of each other belong to the same session; we add LEAD minutes of
 * pre-commit work before each session's first commit.
 */
function estimateHoursFromCommits(commits: Commit[]): number {
  const GAP_MIN = 120;
  const LEAD_MIN = 30;
  const times = commits
    .map((c) => new Date(c.date).getTime())
    .sort((a, b) => a - b);
  if (times.length === 0) return 0;

  let total = 0;
  let sessionStart = times[0];
  let prev = times[0];
  for (let i = 1; i <= times.length; i++) {
    const t = times[i];
    const gap = t === undefined ? Infinity : (t - prev) / 60000;
    if (gap > GAP_MIN) {
      total += (prev - sessionStart) / 60000 + LEAD_MIN; // session span + lead
      sessionStart = t;
    }
    prev = t;
  }
  return total / 60;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function bar(score: number): string {
  const filled = Math.round(score);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

async function main() {
  loadEnv();
  if (!process.env.OPENAI_API_KEY) {
    console.error("✖ OPENAI_API_KEY is not set (add it to .env.local).");
    process.exit(1);
  }

  const days = Number.parseInt(process.env.ANALYZE_DAYS ?? "7", 10);
  const model = process.env.CHAT_MODEL || "gpt-4o";

  ensureRepo();
  const author = process.env.ANALYZE_AUTHOR || git("config user.email");
  console.log(`\n🔎 Analyzing commits by ${author} over the last ${days} days\n`);

  pull();

  const commits = collectCommits(days, author);
  if (commits.length === 0) {
    console.log("No commits found in this window. Nothing to analyze.");
    return;
  }
  console.log(`Found ${commits.length} commit(s). Reviewing code quality…\n`);

  const reviews: { commit: Commit; quality: Quality | null }[] = [];
  for (const c of commits) {
    process.stdout.write(`  • ${c.hash.slice(0, 7)} ${c.subject.slice(0, 60)}\n`);
    const quality = await reviewCommit(model, c);
    reviews.push({ commit: c, quality });
  }

  const scored = reviews.filter((r) => r.quality) as {
    commit: Commit;
    quality: Quality;
  }[];
  const hasScores = scored.length > 0;
  const fmtScore = (v: number) => (hasScores ? v.toFixed(1) : "n/a");

  // Weight overall score by lines changed so big commits count more.
  const totalLines = scored.reduce((s, r) => s + r.commit.added + r.commit.deleted, 0) || 1;
  const weightedOverall = scored.reduce(
    (s, r) => s + r.quality.overall * (r.commit.added + r.commit.deleted),
    0,
  ) / totalLines;

  const dimAverages = {
    readability: avg(scored.map((r) => r.quality.readability)),
    structure: avg(scored.map((r) => r.quality.structure)),
    errorHandling: avg(scored.map((r) => r.quality.errorHandling)),
    testing: avg(scored.map((r) => r.quality.testing)),
    commitMessage: avg(scored.map((r) => r.quality.commitMessage)),
  };

  // Hours
  const wakaHours = await wakatimeHours(days);
  const estHours = estimateHoursFromCommits(commits);
  const hours = wakaHours ?? estHours;
  const hoursSource = wakaHours != null ? "WakaTime (measured)" : "git timestamps (estimated)";

  const totalAdded = commits.reduce((s, c) => s + c.added, 0);
  const totalDeleted = commits.reduce((s, c) => s + c.deleted, 0);

  // ---- Console report ----
  console.log("\n" + "═".repeat(60));
  console.log("  COMMIT ANALYSIS — past " + days + " days");
  console.log("═".repeat(60));
  console.log(`  Commits:        ${commits.length}`);
  console.log(`  Lines:          +${totalAdded} / -${totalDeleted}`);
  console.log(`  Hours:          ${hours.toFixed(1)}h  (${hoursSource})`);
  console.log(
    `  Lines/hour:     ${hours > 0 ? Math.round((totalAdded + totalDeleted) / hours) : "n/a"}`,
  );
  console.log("─".repeat(60));
  if (!hasScores) {
    console.log("  Overall quality: n/a (no commits could be reviewed — check OPENAI_API_KEY / quota)");
  } else {
    console.log(`  Overall quality: ${weightedOverall.toFixed(1)}/10  ${bar(weightedOverall)}`);
    for (const [k, v] of Object.entries(dimAverages)) {
      console.log(`   ${k.padEnd(14)} ${v.toFixed(1)}  ${bar(v)}`);
    }
  }
  console.log("═".repeat(60) + "\n");

  // ---- Markdown report ----
  const md: string[] = [];
  md.push(`# Commit Analysis — past ${days} days`);
  md.push("");
  md.push(`_Generated ${new Date().toISOString()} for \`${author}\`_`);
  md.push("");
  md.push("## Summary");
  md.push("");
  md.push(`| Metric | Value |`);
  md.push(`| --- | --- |`);
  md.push(`| Commits | ${commits.length} |`);
  md.push(`| Lines changed | +${totalAdded} / -${totalDeleted} |`);
  md.push(`| Hours | ${hours.toFixed(1)}h — ${hoursSource} |`);
  md.push(`| Overall quality | ${hasScores ? `**${weightedOverall.toFixed(1)} / 10**` : "n/a (no commits reviewed)"} |`);
  md.push("");
  md.push("### Quality by dimension");
  md.push("");
  md.push(`| Dimension | Score |`);
  md.push(`| --- | --- |`);
  for (const [k, v] of Object.entries(dimAverages)) md.push(`| ${k} | ${fmtScore(v)} |`);
  md.push("");
  md.push("## Per-commit");
  md.push("");
  for (const { commit, quality } of reviews) {
    md.push(`### \`${commit.hash.slice(0, 7)}\` ${commit.subject}`);
    md.push(`*${new Date(commit.date).toLocaleString()} · ${commit.files} files · +${commit.added}/-${commit.deleted}*`);
    md.push("");
    if (!quality) {
      md.push("_Review unavailable._");
      md.push("");
      continue;
    }
    md.push(`**Overall: ${quality.overall}/10** — ${quality.summary}`);
    md.push("");
    md.push(
      `Readability ${quality.readability} · Structure ${quality.structure} · ` +
        `Error handling ${quality.errorHandling} · Testing ${quality.testing} · ` +
        `Commit msg ${quality.commitMessage}`,
    );
    if (quality.strengths.length) md.push(`- 👍 ${quality.strengths.join("; ")}`);
    if (quality.concerns.length) md.push(`- 👀 ${quality.concerns.join("; ")}`);
    md.push("");
  }
  md.push("---");
  md.push("");
  md.push(
    hoursSource.startsWith("git")
      ? "_Hours are estimated by grouping commits into sessions (≤120 min gaps) plus 30 min of pre-commit work per session. Set `WAKATIME_API_KEY` for measured time._"
      : "_Hours measured via the WakaTime API for the period._",
  );

  writeFileSync("commit-analysis.md", md.join("\n"), "utf8");
  console.log("📝 Wrote commit-analysis.md\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
