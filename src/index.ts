#!/usr/bin/env node
/**
 * promptkarma CLI.
 * v1: `scan` — 로컬 로그를 훑어 지표를 출력하고 state.json에 저장.
 */
import { scan, saveState, claudeProjectsDir, stateDir } from "./scan.js";
import { MIN_SAMPLE, type Metrics } from "./metrics.js";
import { renderCard } from "./card.js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
  const result = scan(root);
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
    console.log("  인성 축");
    console.log(`    욕설 발생률    ${m.profanityRate.toFixed(1)}%`);
    if (m.promptsPerSwear === null) {
      console.log(`                   욕설 없음`);
    } else {
      console.log(`                   약 ${Math.round(m.promptsPerSwear)}번 대화에 1번 욕함`);
    }
    console.log("");
    console.log("  능력 축");
    console.log(`    구조화 지수    ${m.competence.toFixed(1)}%`);
  }

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
  const saved = JSON.parse(readFileSync(statePath, "utf8")) as { metrics: Metrics };
  const username = process.argv[3] ?? "you";

  const m = saved.metrics;
  const svg = renderCard({ username, metrics: m });
  const out = join(stateDir(), "card.svg");
  writeFileSync(out, svg);

  const q = new URLSearchParams({
    u: username,
    f: m.profanityRate.toFixed(1),
    d: m.competence.toFixed(1),
    p: String(m.prompts),
  });
  if (m.promptsPerSwear !== null) q.set("pps", m.promptsPerSwear.toFixed(1));
  const url = `https://promptkarma.vercel.app/api/card?${q.toString()}`;

  console.log(`카드 생성됨: ${out}`);
  console.log("\nREADME나 프로필에 붙여넣기:");
  console.log(`![promptkarma](${url})`);
}

function help(): void {
  console.log(`
promptkarma — AI CLI 세션에서 당신의 프롬프트를 측정합니다.

사용법:
  promptkarma scan     로컬 로그를 스캔하고 지표를 출력
  promptkarma --help   이 도움말

측정하는 것:
  인성 축   AI를 대하는 태도 (욕설 발생률)
  능력 축   지시의 구조화 정도

원문은 어디에도 저장·전송되지 않습니다. 숫자만 로컬에 남습니다.
`);
}

const cmd = process.argv[2] ?? "scan";
switch (cmd) {
  case "scan":
    runScan();
    break;
  case "card":
    runCard();
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
