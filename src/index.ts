#!/usr/bin/env node
/**
 * promptkarma CLI.
 * v1: `scan` — 로컬 로그를 훑어 지표를 출력하고 state.json에 저장.
 */
import { scan, saveState, claudeProjectsDir, stateDir } from "./scan.js";
import { MIN_SAMPLE, type Metrics } from "./metrics.js";
import { renderFeedbackCard } from "./card.js";
import { buildFeedback } from "./feedback.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface StoredState {
  metrics: Metrics;
  scannedAt?: string;
  filterVersion?: number;
}

function n(x: number): string {
  return x.toLocaleString("en-US");
}

function runScan(): void {
  const root = claudeProjectsDir();
  if (!existsSync(root)) {
    console.error(`세션 로그를 찾을 수 없습니다: ${root}`);
    console.error("Claude Code를 한 번이라도 실행한 적이 있어야 합니다.");
    process.exit(1);
  }

  const t0 = Date.now();
  const explain = process.argv.includes("--explain");
  const result = scan(root, { explain });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const m = result.metrics;

  const line = "─".repeat(34);
  console.log("");
  console.log("  promptkarma · 로컬 스캔");
  console.log("  " + line);
  console.log(`  스캔한 파일      ${n(result.filesScanned)}개`);
  console.log(`  사람 프롬프트    ${n(m.prompts)}개  (슬래시커맨드 ${n(m.slash)}개)`);
  if (result.duplicatesSkipped) {
    console.log(`  중복 제거        ${n(result.duplicatesSkipped)}개`);
  }
  console.log("");

  if (!m.eligible) {
    console.log(`  측정 중 — 프롬프트 ${MIN_SAMPLE}개 이상 필요 (현재 ${n(m.prompts)}개)`);
  } else {
    console.log("  관찰값");
    console.log(`    구조 신호      ${m.competence.toFixed(1)}%`);
    if (m.habits) {
      console.log("");
      console.log("  프롬프트 습관");
      console.log(`    맥락 단서      ${m.habits.contextRate.toFixed(1)}%  파일·코드·링크`);
      console.log(`    조건·기준      ${m.habits.constraintRate.toFixed(1)}%`);
      console.log(`    단계·목록      ${m.habits.stepRate.toFixed(1)}%`);
      console.log(`    통째 위임      ${m.habits.outsourceRate.toFixed(1)}%  판단 기준 없이 알아서·아무거나`);
    }
    console.log("");
    console.log("  말투 참고");
    console.log(`    욕설 탐지      ${m.profanityRate.toFixed(1)}%`);
    if (m.promptsPerSwear === null) {
      console.log(`                   탐지된 표현 없음`);
    } else {
      console.log(`                   약 ${Math.round(m.promptsPerSwear)}번 프롬프트에 1번 탐지`);
    }
  }

  if (explain) {
    const labels = {
      context: "맥락 단서",
      constraints: "조건·기준",
      steps: "단계·목록",
      outsourced: "통째 위임",
      profanity: "욕설 사전",
    };
    console.log("");
    console.log("  탐지 근거 — 이 화면에만 표시하며 저장·전송하지 않음");
    if (!result.examples?.length) {
      console.log("    일치한 예시 없음");
    } else {
      for (const example of result.examples) {
        console.log(`    [${labels[example.signal]}] ${example.file}:${example.line}`);
        console.log(`      ${example.excerpt}`);
      }
    }
  }

  const feedback = buildFeedback(m);
  console.log("");
  console.log("  다음에 해볼 한 가지");
  console.log(`    ${feedback.tip}`);
  console.log("  " + line);
  const path = saveState(result);
  console.log(`  ${secs}초 · 저장됨 ${path}`);
  console.log("");
}

function runCard(): void {
  const statePath = join(stateDir(), "state.json");
  if (!existsSync(statePath)) {
    console.error("먼저 스캔이 필요합니다: promptkarma scan");
    process.exit(1);
  }
  const saved = JSON.parse(readFileSync(statePath, "utf8")) as StoredState;
  const username = process.argv[3] ?? "you";

  const m: Metrics = {
    ...saved.metrics,
    eligible: saved.metrics.eligible ?? (saved.metrics.prompts >= MIN_SAMPLE),
    praiseRate: Number.isFinite(saved.metrics.praiseRate) ? saved.metrics.praiseRate : 0,
    karma: saved.metrics.karma ?? "white",
  };
  const svg = renderFeedbackCard({
    username,
    metrics: m,
    provenance: "local",
    scannedAt: saved.scannedAt,
    filterVersion: saved.filterVersion,
  });
  const out = join(stateDir(), "card.svg");
  writeFileSync(out, svg);

  console.log(`카드 생성됨: ${out}`);
  console.log("집계값은 전송하지 않았습니다. 공개 공유가 필요하면 submit을 따로 실행하세요.");
}

const API_BASE = process.env.PROMPTKARMA_API ?? "https://promptkarma.vercel.app";

async function runSubmit(): Promise<void> {
  const statePath = join(stateDir(), "state.json");
  if (!existsSync(statePath)) {
    console.error("먼저 스캔이 필요합니다: promptkarma scan");
    process.exit(1);
  }
  const username = process.argv[3];
  if (!username) {
    console.error("사용법: promptkarma submit <github-username>");
    process.exit(1);
  }
  const saved = JSON.parse(readFileSync(statePath, "utf8")) as StoredState;
  const m = saved.metrics;

  const res = await fetch(`${API_BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      u: username,
      f: m.profanityRate,
      d: m.competence,
      p: m.prompts,
      pps: m.promptsPerSwear ?? 0,
      praise: m.praiseRate,
      karma: m.karma,
      contextRate: m.habits?.contextRate,
      constraintRate: m.habits?.constraintRate,
      stepRate: m.habits?.stepRate,
      outsourceRate: m.habits?.outsourceRate,
      scannedAt: saved.scannedAt,
      filterVersion: saved.filterVersion,
      metricVersion: m.metricVersion,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    console.error(`제출 실패 (${res.status}): ${body.error ?? "알 수 없음"}`);
    process.exit(1);
  }

  const url = `${API_BASE}/api/card?u=${encodeURIComponent(username)}&style=coach&theme=black`;
  console.log(`제출 완료: ${username}`);
  console.log("공개 카드는 계정·로그가 검증되지 않은 SELF-REPORTED 값으로 표시됩니다.");
  console.log("\n같은 주소를 붙여두고, 다시 scan 후 submit하면 값이 갱신됩니다:");
  console.log(`![promptkarma](${url})`);
}

function help(): void {
  console.log(`
promptkarma — Claude Code 로그에서 프롬프트 습관을 로컬로 점검합니다.

사용법:
  promptkarma scan              로컬 로그를 스캔하고 지표를 출력
  promptkarma scan --explain    탐지된 짧은 예시를 화면에만 표시
  promptkarma card <label>      지표를 SVG 카드로 렌더(로컬)
  promptkarma submit <username> 지표를 서버에 올려 공개 카드 갱신
  promptkarma --help            이 도움말

측정하는 것:
  관찰값    욕설 포함 비율, 구조 신호 비율
  습관      맥락, 조건, 단계, 통째 위임 표현
  피드백    다음 프롬프트에서 해볼 한 가지

이 값은 능력 검사가 아닌 설명 가능한 휴리스틱입니다.
원문은 저장·전송하지 않고 집계 숫자만 로컬에 남깁니다.
`);
}

async function main(): Promise<void> {
  const cmd = process.argv[2] ?? "scan";
  switch (cmd) {
    case "scan":
      runScan();
      break;
    case "card":
      runCard();
      break;
    case "submit":
      await runSubmit();
      break;
    case "-h":
    case "--help":
    case "help":
      help();
      break;
    default:
      console.error(`알 수 없는 명령: ${cmd}\n"promptkarma --help"를 보세요.`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
