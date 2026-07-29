/**
 * 로컬 세션 로그를 훑어 카운터를 뽑고 state.json에 저장.
 *
 * v1은 전체 스캔이다. uuid 중복만 제거한다(세션 resume 시 앞 히스토리가
 * 새 파일로 복사되므로). 24시간 증분(워터마크)은 다음 단계.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { parseLine } from "./parser.js";
import { FILTER_VERSION } from "./parser.js";
import { emptyCounters, accumulate, finalize, type Counters, type Metrics } from "./metrics.js";
import { countProfanity } from "./lexicon.js";
import { analyzeSignals } from "./signals.js";

/** Claude Code 세션 로그 위치. 크로스플랫폼(홈 기준). */
export function claudeProjectsDir(): string {
  return join(homedir(), ".claude", "projects");
}

/** promptkarma 로컬 상태 저장 위치. */
export function stateDir(): string {
  return join(homedir(), ".promptkarma");
}

export function listSessionFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith(".jsonl"))
    .map((p) => join(root, p));
}

export interface ScanResult {
  counters: Counters;
  metrics: Metrics;
  filesScanned: number;
  duplicatesSkipped: number;
  /** --explain에서만 메모리에 모으며 state.json에는 저장하지 않는다. */
  examples?: ScanExample[];
}

export type ExampleSignal = "context" | "constraints" | "steps" | "outsourced" | "profanity";

export interface ScanExample {
  signal: ExampleSignal;
  file: string;
  line: number;
  excerpt: string;
}

export interface ScanOptions {
  explain?: boolean;
  examplesPerSignal?: number;
}

function excerpt(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 140 ? oneLine.slice(0, 139) + "…" : oneLine;
}

export function scan(root: string = claudeProjectsDir(), options: ScanOptions = {}): ScanResult {
  const counters = emptyCounters();
  const seen = new Set<string>();
  const examples: ScanExample[] = [];
  const exampleCounts = new Map<ExampleSignal, number>();
  const exampleLimit = Math.max(1, Math.min(3, options.examplesPerSignal ?? 1));
  let duplicatesSkipped = 0;

  const files = listSessionFiles(root);
  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!line) continue;
      const rec = parseLine(line);
      if (!rec) continue;
      if (rec.uuid) {
        if (seen.has(rec.uuid)) {
          duplicatesSkipped++;
          continue;
        }
        seen.add(rec.uuid);
      }
      accumulate(counters, rec);
      if (options.explain && rec.kind === "prompt") {
        const signals = analyzeSignals(rec.text);
        const matched: ExampleSignal[] = [];
        if (signals.context) matched.push("context");
        if (signals.constraints) matched.push("constraints");
        if (signals.steps) matched.push("steps");
        if (signals.outsourced) matched.push("outsourced");
        if (countProfanity(rec.text) > 0) matched.push("profanity");
        for (const signal of matched) {
          const count = exampleCounts.get(signal) ?? 0;
          if (count >= exampleLimit) continue;
          examples.push({ signal, file: relative(root, file), line: index + 1, excerpt: excerpt(rec.text) });
          exampleCounts.set(signal, count + 1);
        }
      }
    }
  }

  return {
    counters,
    metrics: finalize(counters),
    filesScanned: files.length,
    duplicatesSkipped,
    ...(options.explain ? { examples } : {}),
  };
}

/** 카운터·지표를 state.json에 기록하고 경로를 반환. 원문은 저장하지 않는다. */
export function saveState(result: ScanResult): string {
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "state.json");
  const payload = {
    filterVersion: FILTER_VERSION,
    scannedAt: new Date().toISOString(),
    counters: result.counters,
    metrics: result.metrics,
  };
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n");
  return path;
}
