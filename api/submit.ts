/**
 * POST /api/submit — 로컬에서 계산한 지표를 저장(UPSERT). username당 최신 하나.
 * body에는 두 축의 집계값, 스캔 시각과 규칙 버전만 받는다. 원문은 받지 않는다.
 * 인증이 없으므로 공개 카드는 SELF-REPORTED로 표시한다.
 */
import { upsertCard, ensureSchema, type CardWrite } from "../src/db.js";
import { karmaMode } from "../src/metrics.js";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function positiveInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null;
}

function scanTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms) || ms > Date.now() + 5 * 60_000) return null;
  return new Date(ms).toISOString();
}

type PersistCard = (row: CardWrite) => Promise<void>;

const persistCard: PersistCard = async (row) => {
  await ensureSchema();
  await upsertCard(row);
};

export async function handleSubmit(
  req: any,
  res: any,
  persist: PersistCard = persistCard,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only" });
    return;
  }
  let b: any;
  try {
    b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body ?? {});
  } catch {
    res.status(400).json({ error: "invalid JSON body" });
    return;
  }
  const username = String(b.u ?? b.username ?? "").trim().toLowerCase();
  const validUsername = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/.test(username);
  if (!validUsername) {
    res.status(400).json({ error: "valid GitHub username(u) required" });
    return;
  }
  const prompts = Math.min(2_147_483_647, Math.max(0, Math.floor(num(b.p))));
  const profanity = prompts > 0 ? clamp(num(b.f), 0, 100) : 0;
  const competence = prompts > 0 ? clamp(num(b.d), 0, 100) : 0;
  const praise = prompts > 0 ? clamp(num(b.praise), 0, 100) : 0;
  const profanePrompts = profanity > 0
    ? Math.max(1, Math.round((prompts * profanity) / 100))
    : 0;
  const praisePrompts = praise > 0
    ? Math.max(1, Math.round((prompts * praise) / 100))
    : 0;

  try {
    await persist({
      username,
      profanity,
      competence,
      prompts,
      promptsPerSwear: profanePrompts > 0 ? prompts / profanePrompts : null,
      praise,
      karma: karmaMode(profanePrompts, praisePrompts, profanity),
      scannedAt: scanTime(b.scannedAt),
      filterVersion: positiveInt(b.filterVersion),
      metricVersion: positiveInt(b.metricVersion),
    });
    res.status(200).json({ ok: true, username });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
}

export default async function handler(req: any, res: any): Promise<void> {
  return handleSubmit(req, res);
}
