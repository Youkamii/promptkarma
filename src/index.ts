#!/usr/bin/env node
/**
 * promptkarma CLI.
 * Claude Code 로그를 로컬에서 집계해 KARMA × INTELLECT 배지로 만든다.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderPolytope } from "./card.js";
import { MIN_SAMPLE, type Metrics } from "./metrics.js";
import { claudeProjectsDir, saveState, scan, stateDir } from "./scan.js";

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
    console.log("  KARMA · AI를 대하는 태도");
    console.log(`    욕설 발생률    ${m.profanityRate.toFixed(1)}%`);
    if (m.promptsPerSwear === null) {
      console.log("                   탐지된 욕설 없음");
    } else {
      console.log(`                   약 ${Math.round(m.promptsPerSwear)}번 대화에 1번 탐지`);
    }
    console.log("");
    console.log("  INTELLECT · AI 활용 방식");
    console.log(`    구조화 지수    ${m.competence.toFixed(1)}%`);
  }

  console.log("  " + line);
  const path = saveState(result);
  console.log(`  ${secs}초 · 저장됨 ${path}`);
  console.log("");
}

function readState(): StoredState {
  const statePath = join(stateDir(), "state.json");
  if (!existsSync(statePath)) {
    console.error("먼저 스캔이 필요합니다: promptkarma scan");
    process.exit(1);
  }
  return JSON.parse(readFileSync(statePath, "utf8")) as StoredState;
}

function normalizedMetrics(metrics: Metrics): Metrics {
  return {
    ...metrics,
    eligible: metrics.eligible ?? metrics.prompts >= MIN_SAMPLE,
    praiseRate: Number.isFinite(metrics.praiseRate) ? metrics.praiseRate : 0,
    karma: metrics.karma ?? "white",
  };
}

function runCard(): void {
  const saved = readState();
  const username = process.argv[3] ?? "you";
  const svg = renderPolytope({
    username,
    metrics: normalizedMetrics(saved.metrics),
    provenance: "local",
    scannedAt: saved.scannedAt,
    filterVersion: saved.filterVersion,
  });
  const out = join(stateDir(), "card.svg");
  writeFileSync(out, svg);

  console.log(`배지 생성됨: ${out}`);
  console.log("집계값은 전송하지 않았습니다. 공개 공유가 필요하면 submit을 따로 실행하세요.");
}

const API_BASE = process.env.PROMPTKARMA_API ?? "https://promptkarma.vercel.app";

async function runSubmit(): Promise<void> {
  const saved = readState();
  const username = process.argv[3];
  if (!username) {
    console.error("사용법: promptkarma submit <github-username>");
    process.exit(1);
  }
  const m = normalizedMetrics(saved.metrics);
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
      scannedAt: saved.scannedAt,
      filterVersion: saved.filterVersion,
      metricVersion: m.metricVersion ?? 1,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    console.error(`제출 실패 (${res.status}): ${body.error ?? "알 수 없음"}`);
    process.exit(1);
  }

  const url = `${API_BASE}/api/card?u=${encodeURIComponent(username)}&style=polytope`;
  console.log(`제출 완료: ${username}`);
  console.log("공개 배지는 계정·로그가 검증되지 않은 SELF-REPORTED 값으로 표시됩니다.");
  console.log("\n같은 주소를 붙여두고, 다시 scan 후 submit하면 값이 갱신됩니다:");
  console.log(`![promptkarma](${url})`);
}

function help(): void {
  console.log(`
promptkarma — Claude Code 프롬프트를 KARMA × INTELLECT 배지로 만듭니다.

사용법:
  promptkarma scan              로컬 로그를 스캔하고 두 축을 출력
  promptkarma card <label>      지표를 SVG 배지로 렌더(로컬)
  promptkarma submit <username> 지표를 서버에 올려 공개 배지 갱신
  promptkarma --help            이 도움말

측정하는 것:
  KARMA       AI를 대하는 태도 (욕설 발생률)
  INTELLECT   지시의 구조와 도구 활용 정도

정규식으로 만든 배지용 지표이며 능력 검사나 자격증이 아닙니다.
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
