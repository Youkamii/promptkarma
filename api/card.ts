/**
 * Vercel serverless function: GET /api/card
 * 지표를 쿼리로 받아 SVG를 반환한다. GitHub README <img>가 이 URL을 부르면
 * 프로필에 카드가 뜬다. v1은 DB 없이 쿼리 방식(자동 갱신은 이후 submit+저장으로).
 *
 * 예: /api/card?u=Youkamii&f=7.3&d=50.4&p=3398&pps=13.7
 */
import { renderCard } from "../src/card.js";
import type { Metrics } from "../src/metrics.js";

function num(v: unknown): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default function handler(req: any, res: any): void {
  const q = req.query ?? {};
  const username = String(q.u ?? q.username ?? "you").slice(0, 39) || "you";
  const prompts = Math.max(0, Math.floor(num(q.p)));
  const pps = num(q.pps);

  const metrics: Metrics = {
    prompts,
    slash: 0,
    profanityRate: clamp(num(q.f), 0, 100),
    competence: clamp(num(q.d), 0, 100),
    promptsPerSwear: pps > 0 ? pps : null,
    eligible: prompts >= 30,
  };

  const svg = renderCard({ username, metrics });
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  // GitHub camo 프록시가 캐시하되 5분 뒤 갱신 시도. 지표가 바뀌면 반영됨.
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=86400");
  res.status(200).send(svg);
}
