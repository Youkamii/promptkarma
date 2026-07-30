/** 프롬프트의 구조를 판별하는 단순하고 재현 가능한 규칙. */

const FILE_PATH =
  /[\w./\\-]+\.(py|ts|tsx|js|jsx|rs|go|java|json|md|ya?ml|toml|sh|sql|css|html)\b/i;
const LIST_ITEM = /^\s*(\d+[.)]|[-*])\s+/gm;
const SPEC = /(조건[:：]|요구사항|반드시|절대|단,|제약|기준[:：]|우선순위|\bmust\b|\bshould\b|\brequire)/i;
const CODE_FENCE = /```/;
const URL = /https?:\/\//;

/** 파일·코드·링크·조건·목록 중 하나라도 있으면 구조가 있는 프롬프트다. */
export function isStructured(text: string): boolean {
  return FILE_PATH.test(text)
    || CODE_FENCE.test(text)
    || URL.test(text)
    || SPEC.test(text)
    || (text.match(LIST_ITEM)?.length ?? 0) >= 2;
}
