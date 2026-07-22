/**
 * 욕설 탐지. 설계 원칙(probe로 검증):
 *  - 전수 사전화는 불가능. 어근 사전 + 입력 정규화로 변형 표기를 회수한다.
 *  - 정규식 매칭만. LLM은 런타임에 관여하지 않는다(재현성·비용).
 *  - "붙여넣은 문서 속 욕"은 parser 단계에서 이미 걸러진 뒤 여기 도달한다.
 *
 * 누락률 측정(사용자 로그 기준): 기본 어근 대비 정규화로 14.3% 회수.
 */

/** 완성형 어근. 활용형은 넣지 않는다 — "좆" 하나로 좆같/좆됐/좆나가 잡힌다. */
const ROOTS = [
  "시발", "씨발", "시바", "씨바", "좆", "존나", "병신", "개새", "새끼",
  "미친", "닥쳐", "꺼져", "지랄", "엿먹", "등신", "멍청", "바보", "짜증", "빡쳐",
  "fuck", "shit", "damn", "stupid", "idiot", "wtf", "crap", "useless",
];

/** 초성체. 완성형과 겹치지 않으므로 별도 매칭. 단독 자모(ㅗ 등)는 오탐이라 제외. */
const JAMO = ["ㅅㅂ", "ㅆㅂ", "ㅄ", "ㅂㅅ", "ㅈㄴ", "ㅁㅊ", "ㅈㄹ", "ㄲㅈ", "ㄷㅊ"];

/** 한글 완성형/영문이 아닌 문자 = 노이즈. 난독화(시1발, 씨@발, 시 발) 제거용. */
const NOISE = /[^가-힣a-zA-Z]+/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ROOT_RE = new RegExp(ROOTS.map(escapeRegex).join("|"), "gi");
const JAMO_RE = new RegExp(JAMO.map(escapeRegex).join("|"), "g");

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * 욕설 히트 수. raw 매칭과 정규화 매칭 중 큰 값을 취하고(난독화 회수),
 * 초성체는 정규화하면 사라지므로 raw에서만 따로 더한다.
 */
export function countProfanity(text: string): number {
  const raw = countMatches(text, ROOT_RE);
  const collapsed = countMatches(text.replace(NOISE, ""), ROOT_RE);
  const jamo = countMatches(text, JAMO_RE);
  return Math.max(raw, collapsed) + jamo;
}

/** 프롬프트 단위 F 지표용: 한 번이라도 욕이 있으면 true. */
export function hasProfanity(text: string): boolean {
  return countProfanity(text) > 0;
}
