/**
 * Neon(서버리스 Postgres) 접근. 서버는 username당 최신 지표 스냅샷 하나만
 * 저장한다(집계값). uuid 중복 제거는 로컬 scan이 이미 처리하므로 서버엔
 * 원장이 필요 없다. submit이 UPSERT하면 card가 최신을 읽어 자동 갱신된다.
 *
 * 원문은 절대 저장하지 않는다. 숫자만.
 */
import { neon } from "@neondatabase/serverless";

export interface CardRow {
  username: string;
  profanity: number;       // F: 욕설 발생률 %
  competence: number;      // D: 구조화 지수 %
  prompts: number;
  promptsPerSwear: number | null;
  praise: number;          // 칭찬 발생률 %
  karma: string;           // "cyan" | "white" | "black" (오라 색)
  contextRate: number | null;
  constraintRate: number | null;
  stepRate: number | null;
  outsourceRate: number | null;
  scannedAt: string | null;
  filterVersion: number | null;
  metricVersion: number | null;
  updatedAt: string;
}

export type CardWrite = Omit<CardRow, "updatedAt">;

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 미설정");
  return neon(url);
}

export async function ensureSchema(): Promise<void> {
  const db = sql();
  await db`CREATE TABLE IF NOT EXISTS cards (
    username          text PRIMARY KEY,
    profanity         real    NOT NULL,
    competence        real    NOT NULL,
    prompts           integer NOT NULL,
    prompts_per_swear real,
    updated_at        timestamptz NOT NULL DEFAULT now()
  )`;
  // karma·praise는 나중에 추가된 컬럼. 기존 테이블에도 안전하게 붙인다.
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS praise real NOT NULL DEFAULT 0`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS karma text NOT NULL DEFAULT 'white'`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS context_rate real`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS constraint_rate real`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS step_rate real`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS outsource_rate real`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS scanned_at timestamptz`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS filter_version integer`;
  await db`ALTER TABLE cards ADD COLUMN IF NOT EXISTS metric_version integer`;
}

export async function upsertCard(r: CardWrite): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO cards (
      username, profanity, competence, prompts, prompts_per_swear, praise, karma,
      context_rate, constraint_rate, step_rate, outsource_rate,
      scanned_at, filter_version, metric_version, updated_at
    )
    VALUES (
      COALESCE((
        SELECT c.username FROM cards c
        WHERE lower(c.username) = lower(${r.username})
        ORDER BY c.updated_at DESC
        LIMIT 1
      ), ${r.username}),
      ${r.profanity}, ${r.competence}, ${r.prompts}, ${r.promptsPerSwear}, ${r.praise}, ${r.karma},
      ${r.contextRate}, ${r.constraintRate}, ${r.stepRate}, ${r.outsourceRate},
      ${r.scannedAt}, ${r.filterVersion}, ${r.metricVersion}, now()
    )
    ON CONFLICT (username) DO UPDATE SET
      profanity = EXCLUDED.profanity,
      competence = EXCLUDED.competence,
      prompts = EXCLUDED.prompts,
      prompts_per_swear = EXCLUDED.prompts_per_swear,
      praise = EXCLUDED.praise,
      karma = EXCLUDED.karma,
      context_rate = EXCLUDED.context_rate,
      constraint_rate = EXCLUDED.constraint_rate,
      step_rate = EXCLUDED.step_rate,
      outsource_rate = EXCLUDED.outsource_rate,
      scanned_at = EXCLUDED.scanned_at,
      filter_version = EXCLUDED.filter_version,
      metric_version = EXCLUDED.metric_version,
      updated_at = now()`;
}

/** username을 대소문자 무시하고 조회. GitHub username은 case-insensitive. */
export async function getCard(username: string): Promise<CardRow | null> {
  const db = sql();
  try {
    const rows = (await db`
      SELECT username, profanity, competence, prompts,
             prompts_per_swear AS "promptsPerSwear", praise, karma,
             context_rate AS "contextRate",
             constraint_rate AS "constraintRate",
             step_rate AS "stepRate",
             outsource_rate AS "outsourceRate",
             scanned_at AS "scannedAt",
             filter_version AS "filterVersion",
             metric_version AS "metricVersion",
             updated_at AS "updatedAt"
      FROM cards WHERE lower(username) = lower(${username})
      ORDER BY updated_at DESC
      LIMIT 1`) as CardRow[];
    return rows[0] ?? null;
  } catch {
    // 새 열을 붙이는 첫 submit 전에도 기존 공개 카드가 계속 보이게 한다.
    const rows = (await db`
      SELECT username, profanity, competence, prompts,
             prompts_per_swear AS "promptsPerSwear", praise, karma,
             updated_at AS "updatedAt"
      FROM cards WHERE lower(username) = lower(${username})
      ORDER BY updated_at DESC
      LIMIT 1`) as Omit<CardRow,
        "contextRate" | "constraintRate" | "stepRate" | "outsourceRate"
        | "scannedAt" | "filterVersion" | "metricVersion">[];
    const row = rows[0];
    return row ? {
      ...row,
      contextRate: null,
      constraintRate: null,
      stepRate: null,
      outsourceRate: null,
      scannedAt: null,
      filterVersion: 1,
      metricVersion: 1,
    } : null;
  }
}
