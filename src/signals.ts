/**
 * 프롬프트에서 직접 확인할 수 있는 작성 습관 신호.
 * 품질·지능을 판정하지 않고 맥락, 조건, 단계 표현이 있는지만 본다.
 */

const FILE_PATH =
  /[\w./\\-]+\.(py|ts|tsx|js|jsx|rs|go|java|json|md|ya?ml|toml|sh|sql|css|html)\b/i;
const LIST_ITEM = /^\s*(\d+[.)]|[-*])\s+/gm;
const SPEC = /(조건[:：]|요구사항|반드시|절대|단,|제약|기준[:：]|우선순위|\bmust\b|\bshould\b|\brequire)/i;
const CODE_FENCE = /```/;
const URL = /https?:\/\//;

/** 구체적인 범위 없이 결정을 통째로 넘길 때 자주 쓰는 표현. */
const OUTSOURCE =
  /(알아서\s*(해|정해|판단|골라)|아무거나\s*(해|골라|정해)|대충\s*(해|만들|고쳐)|\byou\s+decide\b|\bwhatever\s+(works|you\s+want)\b)/i;

export interface PromptSignals {
  /** 파일 경로, 코드 블록, 링크처럼 작업 대상을 가리키는 단서. */
  context: boolean;
  /** 조건, 요구사항, 기준처럼 결과의 범위를 좁히는 표현. */
  constraints: boolean;
  /** 두 개 이상의 목록 항목으로 작업을 나눈 표현. */
  steps: boolean;
  /** "알아서", "아무거나"처럼 결정을 통째로 넘기는 표현. */
  outsourced: boolean;
}

export function analyzeSignals(text: string): PromptSignals {
  return {
    context: FILE_PATH.test(text) || CODE_FENCE.test(text) || URL.test(text),
    constraints: SPEC.test(text),
    steps: (text.match(LIST_ITEM)?.length ?? 0) >= 2,
    outsourced: OUTSOURCE.test(text),
  };
}

/** 맥락·조건·단계 신호 중 하나라도 있으면 구조 신호가 있는 프롬프트다. */
export function isStructured(text: string): boolean {
  const s = analyzeSignals(text);
  return s.context || s.constraints || s.steps;
}

export function isOutsourced(text: string): boolean {
  return analyzeSignals(text).outsourced;
}
