/**
 * Claude Code 세션 JSONL → 사람이 실제로 친 프롬프트만 추출.
 *
 * 필터 정의 v1 (동결). 이걸 바꾸면 전 유저 순위가 한꺼번에 움직이므로
 * 파서를 고칠 땐 FILTER_VERSION을 올린다.
 */

/** 붙여넣은 문서로 간주하는 길이. 초과분은 프롬프트로 세지 않는다(분자·분모 모두 제외). */
export const PASTE_LIMIT = 5000;

/** 필터 정의 버전. 서버 제출 시 함께 보내 세대 간 순위 오염을 막는다. */
export const FILTER_VERSION = 1;

export interface PromptRecord {
  uuid: string;
  timestamp: string;
  sessionId: string;
  kind: "prompt" | "slash";
  /** kind=prompt면 프롬프트 본문, kind=slash면 커맨드명. */
  text: string;
}

const SLASH_TAG = /^<command-name>([^<]*)<\/command-name>/;

/**
 * JSONL 한 줄을 파싱해 사람 프롬프트면 레코드를, 아니면 null을 반환.
 * 반환 규칙:
 *   - slash 커맨드 → kind:"slash" (길이 무관, 도구 활용 신호로 집계)
 *   - PASTE_LIMIT 초과 → null (붙여넣은 문서)
 *   - 그 외 사람 프롬프트 → kind:"prompt"
 */
export function parseLine(line: string): PromptRecord | null {
  let obj: any;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }

  if (obj?.type !== "user" || obj.isMeta) return null;
  // userType이 없거나 external일 때만 사람. 그 외(agent 등)는 하네스가 만든 것.
  if (obj.userType != null && obj.userType !== "external") return null;
  // entrypoint=cli만 사람 손. sdk-cli 등은 프로그램이 호출한 것(자기 오염 배제).
  if (obj.entrypoint != null && obj.entrypoint !== "cli") return null;

  const msg = obj.message;
  if (typeof msg !== "object" || msg === null) return null;

  const content = msg.content;
  let text: string;
  if (typeof content === "string") {
    text = content;
  } else if (Array.isArray(content)) {
    // tool_result가 섞인 레코드는 하네스가 되먹인 도구 출력물이지 사람 말이 아니다.
    if (content.some((b) => b?.type === "tool_result")) return null;
    text = content
      .filter((b) => b?.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");
  } else {
    return null;
  }

  text = text.trim();
  if (!text) return null;

  const base = {
    uuid: typeof obj.uuid === "string" ? obj.uuid : "",
    timestamp: typeof obj.timestamp === "string" ? obj.timestamp : "",
    sessionId: typeof obj.sessionId === "string" ? obj.sessionId : "",
  };

  // 슬래시커맨드: 길이 컷 이전에 분기.
  const slash = text.match(SLASH_TAG);
  if (slash) {
    return { ...base, kind: "slash", text: slash[1]!.trim() };
  }

  // 하네스가 주입한 가짜 유저 턴 제거.
  if (text.startsWith("Caveat:")) return null;
  if (text.startsWith("<") && text.slice(0, 200).includes("system-reminder")) {
    return null;
  }

  // 붙여넣은 문서는 프롬프트로 세지 않는다.
  if (text.length > PASTE_LIMIT) return null;

  return { ...base, kind: "prompt", text };
}

/** 파일 전체 내용을 받아 사람 프롬프트 레코드 배열을 반환. */
export function parseFile(content: string): PromptRecord[] {
  const out: PromptRecord[] = [];
  for (const line of content.split("\n")) {
    if (!line) continue;
    const rec = parseLine(line);
    if (rec) out.push(rec);
  }
  return out;
}
