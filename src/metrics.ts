/**
 * 원시 카운터 → 지표. 전부 로컬에서 나눗셈 한 번으로 나온다.
 * LLM 없음, 임의 가중치 없음, 재현 100%.
 */
import type { PromptRecord } from "./parser.js";
import { countProfanity, hasPraise } from "./lexicon.js";
import { isStructured } from "./signals.js";

/** 이 미만이면 순위에서 제외하고 "측정 중"으로 표시(작은 표본의 F는 신뢰 불가). */
export const MIN_SAMPLE = 30;

/** 서버로 보내는 것은 이 숫자들뿐. 원문은 절대 나가지 않는다. */
export interface Counters {
  prompts: number;        // 붙여넣기·슬래시 제외한 순수 프롬프트 수 (F 분모)
  slash: number;          // 슬래시커맨드 호출 수 (하네스 사용 증거)
  profanePrompts: number; // 욕이 하나라도 든 프롬프트 수 (F 분자)
  profanityHits: number;  // 총 욕설 히트 (표현용)
  praisePrompts: number;  // 칭찬이 든 프롬프트 수 (karma 하늘색 판정)
  structured: number;     // 구조 마커가 든 프롬프트 수 (능력 축)
}

export function emptyCounters(): Counters {
  return { prompts: 0, slash: 0, profanePrompts: 0, profanityHits: 0, praisePrompts: 0, structured: 0 };
}

/** 레코드 하나를 카운터에 반영. */
export function accumulate(c: Counters, rec: PromptRecord): void {
  if (rec.kind === "slash") {
    c.slash++;
    return;
  }
  c.prompts++;
  if (isStructured(rec.text)) c.structured++;
  if (hasPraise(rec.text)) c.praisePrompts++;
  const hits = countProfanity(rec.text);
  if (hits > 0) {
    c.profanePrompts++;
    c.profanityHits += hits;
  }
}

/** karma 오라 색. 칭찬>욕이면 하늘색(레어), 욕 많으면 검정, 그 사이 흰색. */
export type KarmaMode = "cyan" | "white" | "black";
export function karmaMode(profanePrompts: number, praisePrompts: number, profanityRate: number): KarmaMode {
  if (praisePrompts > profanePrompts) return "cyan";
  if (profanityRate >= 15) return "black";
  return "white";
}

export interface Metrics {
  prompts: number;
  slash: number;
  /** F: 욕설 발생률(%). 리더보드 순위 지표. */
  profanityRate: number;
  /** 직설 모드 표현: 몇 번 대화당 한 번 욕하는가. 욕이 없으면 null. */
  promptsPerSwear: number | null;
  /** D: 능력 축(%). 구조 마커·슬래시 사용 비율. 비주얼 모드 이펙트 축. */
  competence: number;
  /** 칭찬이 든 프롬프트 비율(%). */
  praiseRate: number;
  /** karma 오라 색. */
  karma: KarmaMode;
  /** 표본이 MIN_SAMPLE 이상이라 순위에 넣을 수 있는가. */
  eligible: boolean;
}

export function finalize(c: Counters): Metrics {
  const denom = c.prompts + c.slash;
  const profanityRate = c.prompts ? (100 * c.profanePrompts) / c.prompts : 0;
  return {
    prompts: c.prompts,
    slash: c.slash,
    profanityRate,
    promptsPerSwear: c.profanePrompts ? c.prompts / c.profanePrompts : null,
    competence: denom ? (100 * (c.structured + c.slash)) / denom : 0,
    praiseRate: c.prompts ? (100 * c.praisePrompts) / c.prompts : 0,
    karma: karmaMode(c.profanePrompts, c.praisePrompts, profanityRate),
    eligible: c.prompts >= MIN_SAMPLE,
  };
}
