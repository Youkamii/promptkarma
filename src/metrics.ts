/**
 * 원시 카운터 → 지표. 전부 로컬에서 나눗셈 한 번으로 나온다.
 * LLM 없음, 임의 가중치 없음, 재현 100%.
 */
import type { PromptRecord } from "./parser.js";
import { countProfanity, hasPraise } from "./lexicon.js";
import { analyzeSignals } from "./signals.js";

/** 이 미만이면 요약 대신 "측정 중"으로 표시한다. */
export const MIN_SAMPLE = 30;
/** 공개 카드와 로컬 보고서에 표시하는 휴리스틱 규칙 버전. */
export const METRIC_VERSION = 2;

/** 서버로 보내는 것은 이 숫자들뿐. 원문은 절대 나가지 않는다. */
export interface Counters {
  prompts: number;        // 붙여넣기·슬래시 제외한 순수 프롬프트 수 (F 분모)
  slash: number;          // 슬래시커맨드 호출 수 (참고값, 구조 신호에는 넣지 않음)
  profanePrompts: number; // 욕이 하나라도 든 프롬프트 수 (F 분자)
  profanityHits: number;  // 총 욕설 히트 (표현용)
  praisePrompts: number;  // 칭찬이 든 프롬프트 수 (karma 하늘색 판정)
  structured: number;     // 구조 마커가 든 프롬프트 수
  context: number;        // 파일·코드·링크로 작업 맥락을 준 프롬프트 수
  constraints: number;    // 조건·요구사항·기준을 적은 프롬프트 수
  steps: number;          // 두 항목 이상의 목록으로 나눈 프롬프트 수
  outsourced: number;     // 결정을 통째로 넘기는 표현이 든 프롬프트 수
}

export function emptyCounters(): Counters {
  return {
    prompts: 0, slash: 0,
    profanePrompts: 0, profanityHits: 0, praisePrompts: 0,
    structured: 0, context: 0, constraints: 0, steps: 0, outsourced: 0,
  };
}

/** 레코드 하나를 카운터에 반영. */
export function accumulate(c: Counters, rec: PromptRecord): void {
  if (rec.kind === "slash") {
    c.slash++;
    return;
  }
  c.prompts++;
  const signals = analyzeSignals(rec.text);
  if (signals.context || signals.constraints || signals.steps) c.structured++;
  if (signals.context) c.context++;
  if (signals.constraints) c.constraints++;
  if (signals.steps) c.steps++;
  if (signals.outsourced) c.outsourced++;
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
  /** 구조·말투 집계 규칙 버전. 이전 state에는 없을 수 있다. */
  metricVersion?: number;
  prompts: number;
  slash: number;
  /** 욕설 사전에 하나 이상 일치한 사람 프롬프트 비율(%). */
  profanityRate: number;
  /** 몇 번 프롬프트당 한 번 사전에 일치하는가. 일치가 없으면 null. */
  promptsPerSwear: number | null;
  /** 구조 신호(%). 맥락·조건·단계 마커가 관찰된 사람 프롬프트 비율. */
  competence: number;
  /** 칭찬이 든 프롬프트 비율(%). */
  praiseRate: number;
  /** karma 오라 색. */
  karma: KarmaMode;
  /** 표본이 MIN_SAMPLE 이상이라 요약과 피드백을 보여줄 수 있는가. */
  eligible: boolean;
  /** 로컬 코칭용 세부 습관. 이전 state·서버 행에는 없을 수 있다. */
  habits?: HabitRates;
}

export interface HabitRates {
  contextRate: number;
  constraintRate: number;
  stepRate: number;
  outsourceRate: number;
}

export function finalize(c: Counters): Metrics {
  const profanityRate = c.prompts ? (100 * c.profanePrompts) / c.prompts : 0;
  const rate = (count: number | undefined) => c.prompts ? (100 * (count ?? 0)) / c.prompts : 0;
  return {
    metricVersion: METRIC_VERSION,
    prompts: c.prompts,
    slash: c.slash,
    profanityRate,
    promptsPerSwear: c.profanePrompts ? c.prompts / c.profanePrompts : null,
    competence: rate(c.structured),
    praiseRate: c.prompts ? (100 * c.praisePrompts) / c.prompts : 0,
    karma: karmaMode(c.profanePrompts, c.praisePrompts, profanityRate),
    eligible: c.prompts >= MIN_SAMPLE,
    habits: {
      contextRate: rate(c.context),
      constraintRate: rate(c.constraints),
      stepRate: rate(c.steps),
      outsourceRate: rate(c.outsourced),
    },
  };
}
