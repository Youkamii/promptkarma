/**
 * 능력 축(D) 신호. "프롬프트가 길다"가 아니라 "지시가 구조화돼 있다"를 잰다.
 * 길이는 의미 없는 패딩으로 부풀릴 수 있지만 구조는 실제로 명시해야 올라간다.
 *
 * 주의: 하네스(스킬/슬래시커맨드) 사용자는 구조가 스킬 정의로 옮겨가서
 * 프롬프트 본문의 마커가 줄어든다(측정된 상관 -0.684). 그래서 슬래시커맨드
 * 호출은 scan 단계에서 구조화로 별도 합산한다 — 여기서는 본문만 본다.
 */

const FILE_PATH =
  /[\w./\\-]+\.(py|ts|tsx|js|jsx|rs|go|java|json|md|ya?ml|toml|sh|sql|css|html)\b/i;
const LIST_ITEM = /^\s*(\d+[.)]|[-*])\s+/gm;
const SPEC = /(조건[:：]|요구사항|반드시|절대|단,|제약|기준[:：]|우선순위|\bmust\b|\bshould\b|\brequire)/i;
const CODE_FENCE = /```/;
const URL = /https?:\/\//;

/** 사고 외주 패턴. 던지기("알아서 해")와 위임(스펙 다 주고 마지막만)은 길이로 갈린다. */
const OUTSOURCE =
  /(알아서|[니네]가\s*(해|정해|판단|골라)|모르겠|난\s*몰라|아무거나|대충|\bwhatever\b|\byou\s+decide\b)/i;

/** 구조 마커가 하나라도 있으면 true. 파일경로·번호목록(2개+)·조건·코드블록·URL. */
export function isStructured(text: string): boolean {
  if (FILE_PATH.test(text)) return true;
  if ((text.match(LIST_ITEM)?.length ?? 0) >= 2) return true;
  if (SPEC.test(text)) return true;
  if (CODE_FENCE.test(text)) return true;
  if (URL.test(text)) return true;
  return false;
}

export function isOutsourced(text: string): boolean {
  return OUTSOURCE.test(text);
}
