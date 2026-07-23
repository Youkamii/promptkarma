/**
 * Vercel serverless function: GET /api/card?u=<username>
 *
 * 우선순위:
 *   1) DB에 username의 최신 지표가 있으면 그걸로 렌더 (submit이 올린 값 → 자동 갱신)
 *   2) 없고 쿼리에 f/d/p가 오면 그 값으로 렌더 (배포 초기 폴백)
 *   3) 둘 다 없으면 "측정 중" 카드
 */
import { renderCard } from "../src/card.js";
import type { Metrics } from "../src/metrics.js";
import { getCard } from "../src/db.js";

function num(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default async function handler(req: any, res: any): Promise<void> {
  const q = req.query ?? {};
  const username = String(q.u ?? q.username ?? "you").slice(0, 39) || "you";

  let metrics: Metrics | null = null;

  // 1) DB 조회
  try {
    const row = await getCard(username);
    if (row) {
      metrics = {
        prompts: row.prompts,
        slash: 0,
        profanityRate: row.profanity,
        competence: row.competence,
        promptsPerSwear: row.promptsPerSwear,
        eligible: row.prompts >= 30,
      };
    }
  } catch {
    // DB 장애 시 폴백으로 진행
  }

  // 2) 쿼리 폴백
  if (!metrics && q.f != null) {
    const prompts = Math.max(0, Math.floor(num(q.p)));
    const pps = num(q.pps);
    metrics = {
      prompts,
      slash: 0,
      profanityRate: clamp(num(q.f), 0, 100),
      competence: clamp(num(q.d), 0, 100),
      promptsPerSwear: pps > 0 ? pps : null,
      eligible: prompts >= 30,
    };
  }

  // 3) 측정 중
  if (!metrics) {
    metrics = { prompts: 0, slash: 0, profanityRate: 0, competence: 0, promptsPerSwear: null, eligible: false };
  }

  const svg = renderCard({ username, metrics });
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // 짧게 캐시해 submit 반영을 빠르게(엣지 1분). GitHub camo는 별도 캐시라
  // 프로필 표시 반영은 camo TTL이 지배한다(즉시가 아님).
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(svg);
}
