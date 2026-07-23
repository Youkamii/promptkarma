/**
 * POST /api/submit — 로컬에서 계산한 지표를 저장(UPSERT). username당 최신 하나.
 * body: { u, f, d, p, pps }. 인증 없음(v1) — 조작은 허용 정책.
 */
import { upsertCard, ensureSchema } from "../src/db.js";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
  const username = String(b.u ?? b.username ?? "").trim().slice(0, 39);
  if (!username) {
    res.status(400).json({ error: "username(u) required" });
    return;
  }
  const prompts = Math.max(0, Math.floor(num(b.p)));
  const pps = num(b.pps);

  try {
    await ensureSchema();
    await upsertCard({
      username,
      profanity: clamp(num(b.f), 0, 100),
      competence: clamp(num(b.d), 0, 100),
      prompts,
      promptsPerSwear: pps > 0 ? pps : null,
    });
    res.status(200).json({ ok: true, username });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}
