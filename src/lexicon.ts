/**
 * 욕설 탐지. 설계 원칙(probe로 검증):
 *  - 전수 사전화는 불가능. 어근 사전 + 입력 정규화로 변형 표기를 회수한다.
 *  - 정규식 매칭만. LLM은 런타임에 관여하지 않는다(재현성·비용).
 *  - "붙여넣은 문서 속 욕"은 parser 단계에서 이미 걸러진 뒤 여기 도달한다.
 *
 * 누락률 측정(사용자 로그 기준): 기본 어근 대비 정규화로 14.3% 회수.
 */

/** 한글 완성형 어근. 활용형은 넣지 않는다 — "좆" 하나로 좆같/좆됐/좆나가 잡힌다. */
const KOREAN_ROOTS = [
  "시발", "씨발", "시바", "씨바", "좆", "존나", "병신", "개새", "새끼",
  "미친", "닥쳐", "꺼져", "지랄", "엿먹", "등신", "멍청", "바보", "짜증", "빡쳐",
];
const ENGLISH_ROOTS = ["fuck", "shit", "damn", "stupid", "idiot", "wtf", "crap", "useless"];

/** 초성체. 완성형과 겹치지 않으므로 별도 매칭. 단독 자모(ㅗ 등)는 오탐이라 제외. */
const JAMO = ["ㅅㅂ", "ㅆㅂ", "ㅄ", "ㅂㅅ", "ㅈㄴ", "ㅁㅊ", "ㅈㄹ", "ㄲㅈ", "ㄷㅊ"];

/** 한글이 아닌 문자 = 노이즈. 난독화(시1발, 씨@발, 시 발) 제거용. */
const KOREAN_NOISE = /[^가-힣]+/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KOREAN_RE = new RegExp(KOREAN_ROOTS.map(escapeRegex).join("|"), "g");
const ENGLISH_RE = new RegExp(
  `\\b(?:${ENGLISH_ROOTS.map(escapeRegex).join("|")})(?:ing|ed|s|ty)?\\b`,
  "gi",
);
const JAMO_RE = new RegExp(JAMO.map(escapeRegex).join("|"), "g");
/** 어근을 포함하지만 일반 단어로 쓰이는 대표 오탐. */
const SAFE_TERMS = /(시[^가-힣]*발점|새끼[^가-힣]*손가락)/g;

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * 욕설 히트 수. raw 매칭과 정규화 매칭 중 큰 값을 취하고(난독화 회수),
 * 초성체는 정규화하면 사라지므로 raw에서만 따로 더한다.
 */
export function countProfanity(text: string): number {
  const checked = text.replace(SAFE_TERMS, "");
  const rawKorean = countMatches(checked, KOREAN_RE);
  const collapsed = checked.replace(KOREAN_NOISE, "").replace(SAFE_TERMS, "");
  const collapsedKorean = countMatches(collapsed, KOREAN_RE);
  const english = countMatches(checked, ENGLISH_RE);
  const jamo = countMatches(checked, JAMO_RE);
  return Math.max(rawKorean, collapsedKorean) + english + jamo;
}

/** 프롬프트 단위 F 지표용: 한 번이라도 욕이 있으면 true. */
export function hasProfanity(text: string): boolean {
  return countProfanity(text) > 0;
}

/** 칭찬 어근. karma의 하늘색(칭찬>욕) 판정용. */
const PRAISE = [
  "고마", "고맙", "감사", "잘했", "좋아", "굿", "완벽", "수고", "최고",
  "멋지", "멋진", "훌륭", "역시", "짱",
  "thank", "nice", "great", "perfect", "awesome", "good job", "well done",
];
const PRAISE_RE = new RegExp(PRAISE.map(escapeRegex).join("|"), "i");

/** 칭찬이 한 번이라도 있으면 true. */
export function hasPraise(text: string): boolean {
  return PRAISE_RE.test(text);
}
