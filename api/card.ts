/**
 * Vercel serverless function: GET /api/card?u=<username>
 *
 * 지표 우선순위: DB(submit한 값) → 쿼리 f/d/p 폴백 → 측정 중.
 * 외형: theme 프리셋 + 색 개별 오버라이드(bg_color, text_color, karma_color, ...).
 */
import { renderCard, renderFeedbackCard, renderPolytope } from "../src/card.js";
import type { Theme } from "../src/card.js";
import { METRIC_VERSION, MIN_SAMPLE, type Metrics, type KarmaMode } from "../src/metrics.js";
import { getCard, type CardRow } from "../src/db.js";

function asKarma(v: unknown): KarmaMode {
  const s = String(v);
  return s === "cyan" || s === "black" ? s : "white";
}

function num(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
/** hex 색만 허용(SVG 인젝션 차단). "#" 없으면 붙이고, 아니면 undefined. */
function color(v: unknown): string | undefined {
  const s = String(Array.isArray(v) ? v[0] : v ?? "").trim().replace(/^#/, "");
  return /^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s)
    ? "#" + s
    : undefined;
}
function first(v: unknown): string | undefined {
  const s = String(Array.isArray(v) ? v[0] : v ?? "").trim();
  return s || undefined;
}

function positiveInt(v: unknown): number | undefined {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : undefined;
}

type LoadCard = (username: string) => Promise<CardRow | null>;

export async function handleCard(
  req: any,
  res: any,
  loadCard: LoadCard = getCard,
): Promise<void> {
  const q = req.query ?? {};
  const username = String(q.u ?? q.username ?? "you").slice(0, 39) || "you";

  let metrics: Metrics | null = null;
  let provenance: "self-reported" | "unverified" | "missing" | "unavailable" = "missing";
  let scannedAt: string | null = null;
  let filterVersion: number | undefined;
  let loadUnavailable = false;
  try {
    const row = await loadCard(username);
    if (row) {
      const hasHabits = [
        row.contextRate,
        row.constraintRate,
        row.stepRate,
        row.outsourceRate,
      ].every((rate) => rate != null && Number.isFinite(Number(rate)));
      metrics = {
        metricVersion: row.metricVersion ?? (hasHabits ? METRIC_VERSION : 1),
        prompts: row.prompts, slash: 0,
        profanityRate: row.profanity, competence: row.competence,
        promptsPerSwear: row.promptsPerSwear, praiseRate: row.praise ?? 0,
        karma: asKarma(row.karma), eligible: row.prompts >= MIN_SAMPLE,
        ...(hasHabits ? {
          habits: {
            contextRate: Number(row.contextRate),
            constraintRate: Number(row.constraintRate),
            stepRate: Number(row.stepRate),
            outsourceRate: Number(row.outsourceRate),
          },
        } : {}),
      };
      provenance = "self-reported";
      scannedAt = row.scannedAt;
      filterVersion = row.filterVersion ?? 1;
    }
  } catch {
    loadUnavailable = true;
  }

  if (!metrics && q.f != null) {
    const prompts = Math.max(0, Math.floor(num(q.p)));
    const pps = num(q.pps);
    metrics = {
      metricVersion: positiveInt(q.mv) ?? 1,
      prompts, slash: 0,
      profanityRate: clamp(num(q.f), 0, 100), competence: clamp(num(q.d), 0, 100),
      promptsPerSwear: pps > 0 ? pps : null, praiseRate: clamp(num(q.praise), 0, 100),
      karma: asKarma(q.karma), eligible: prompts >= MIN_SAMPLE,
    };
    provenance = "unverified";
    filterVersion = positiveInt(q.fv) ?? 1;
  }
  if (!metrics) {
    provenance = loadUnavailable ? "unavailable" : "missing";
    metrics = { prompts: 0, slash: 0, profanityRate: 0, competence: 0, promptsPerSwear: null, praiseRate: 0, karma: "white", eligible: false };
  }

  // 색 개별 오버라이드 (github-readme-stats 호환 파라미터명 + 우리 것)
  const overrides: Partial<Theme> = {};
  const bg = color(q.bg_color);
  if (bg) { overrides.bg1 = bg; overrides.bg2 = bg; }
  const t = color(q.text_color); if (t) overrides.ink = t;
  const ti = color(q.title_color); if (ti) overrides.title = ti;
  const km = color(q.karma_color); if (km) overrides.karma = km;
  const it = color(q.intel_color); if (it) overrides.intel = it;
  const tr = color(q.track_color); if (tr) overrides.track = tr;
  const mu = color(q.muted_color); if (mu) overrides.muted = mu;
  const bo = color(q.border_color); if (bo) overrides.border = bo;

  const style = first(q.style);
  const input = {
    username,
    metrics,
    theme: first(q.theme),
    colors: overrides,
    provenance,
    scannedAt,
    filterVersion,
  };
  const svg = style === "polytope"
    ? renderPolytope(input)
    : style === "classic"
      ? renderCard(input)
      : renderFeedbackCard(input);
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    provenance === "unavailable"
      ? "no-store, max-age=0"
      : "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
  );
  res.status(200).send(svg);
}

export default async function handler(req: any, res: any): Promise<void> {
  return handleCard(req, res);
}
