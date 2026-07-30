import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFeedback } from "./feedback.js";
import { countProfanity, hasPraise } from "./lexicon.js";
import {
  METRIC_VERSION,
  MIN_SAMPLE,
  accumulate,
  emptyCounters,
  finalize,
  type Metrics,
} from "./metrics.js";
import { PASTE_LIMIT, parseLine, type PromptRecord } from "./parser.js";
import { renderCard, renderFeedbackCard, renderPolytope } from "./card.js";
import { scan } from "./scan.js";
import { analyzeSignals } from "./signals.js";
import { handleCard } from "../api/card.js";
import { handleSubmit } from "../api/submit.js";
import type { CardRow, CardWrite } from "./db.js";

let checks = 0;
const ok = (label: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ok  ${label}`);
};
const okAsync = async (label: string, fn: () => Promise<void>) => {
  await fn();
  checks++;
  console.log(`  ok  ${label}`);
};

const prompt = (text: string): PromptRecord => ({
  uuid: "",
  timestamp: "",
  sessionId: "",
  kind: "prompt",
  text,
});

const sampleMetrics = (overrides: Partial<Metrics> = {}): Metrics => ({
  metricVersion: METRIC_VERSION,
  prompts: 100,
  slash: 0,
  profanityRate: 2.5,
  promptsPerSwear: 40,
  competence: 42.3,
  praiseRate: 0,
  karma: "white",
  eligible: true,
  habits: {
    contextRate: 40,
    constraintRate: 10,
    stepRate: 20,
    outsourceRate: 3,
  },
  ...overrides,
});

console.log("핵심 지표·피드백 회귀 검사");

ok("칭찬 판정은 반복 호출해도 같은 결과다", () => {
  assert.deepEqual(
    Array.from({ length: 6 }, () => hasPraise("고마워")),
    [true, true, true, true, true, true],
  );
  assert.equal(hasPraise("그냥 진행해"), false);
});

ok("대표 일반 단어를 욕설로 잘못 세지 않는다", () => {
  assert.equal(countProfanity("시발점과 새끼손가락, 시 발점과 새끼 손가락, scraper를 설명해줘"), 0);
  assert.equal(countProfanity("시1발 이건 fucking broken"), 2);
});

ok("파서는 사람 입력만 남기고 도구 출력·긴 붙여넣기를 뺀다", () => {
  const line = (content: unknown, extra: Record<string, unknown> = {}) => JSON.stringify({
    type: "user",
    userType: "external",
    entrypoint: "cli",
    message: { content },
    ...extra,
  });
  assert.equal(parseLine(line("직접 입력"))?.text, "직접 입력");
  assert.equal(parseLine(line([{ type: "tool_result", content: "출력" }])), null);
  assert.equal(parseLine(line("x".repeat(PASTE_LIMIT + 1))), null);
  assert.equal(parseLine(line("자동 입력", { entrypoint: "sdk-cli" })), null);
});

ok("맥락·조건·단계·통째 위임 신호를 따로 구분한다", () => {
  assert.deepEqual(
    analyzeSignals("src/index.ts를 고쳐. 반드시 테스트해.\n- 구현\n- 검사"),
    { context: true, constraints: true, steps: true, outsourced: false },
  );
  assert.deepEqual(
    analyzeSignals("대충 알아서 해"),
    { context: false, constraints: false, steps: false, outsourced: true },
  );
  assert.equal(analyzeSignals("모르겠지만 기준: 기존 API를 깨지 말 것").outsourced, false);
});

ok("스캔 집계에 습관별 비율이 남는다", () => {
  const c = emptyCounters();
  accumulate(c, prompt("src/index.ts를 고쳐. 반드시 테스트해.\n- 구현\n- 검사"));
  accumulate(c, prompt("대충 알아서 해"));
  const m = finalize(c);
  assert.deepEqual(m.habits, {
    contextRate: 50,
    constraintRate: 50,
    stepRate: 50,
    outsourceRate: 50,
  });
  assert.equal(m.competence, 50);
});

ok("슬래시 명령 횟수는 구조 신호 점수를 올리지 않는다", () => {
  const c = emptyCounters();
  for (let i = 0; i < MIN_SAMPLE; i++) accumulate(c, prompt("계속 진행해"));
  for (let i = 0; i < MIN_SAMPLE; i++) {
    accumulate(c, { ...prompt("/help"), kind: "slash" });
  }
  const m = finalize(c);
  assert.equal(m.prompts, MIN_SAMPLE);
  assert.equal(m.slash, MIN_SAMPLE);
  assert.equal(m.competence, 0);
});

ok("설명 모드는 짧은 탐지 예시를 메모리에만 돌려준다", () => {
  const dir = mkdtempSync(join(tmpdir(), "promptkarma-test-"));
  try {
    const line = JSON.stringify({
      type: "user",
      userType: "external",
      entrypoint: "cli",
      uuid: "explain-1",
      message: { content: "src/index.ts를 고쳐. 반드시 검사해.\n- 구현\n- 테스트" },
    });
    writeFileSync(join(dir, "session.jsonl"), line + "\n");
    assert.equal(scan(dir).examples, undefined);
    const explained = scan(dir, { explain: true });
    assert.ok(explained.examples?.some((example) => example.signal === "context"));
    assert.ok(explained.examples?.some((example) => example.signal === "constraints"));
    assert.ok(explained.examples?.some((example) => example.signal === "steps"));
    assert.match(explained.examples?.[0]?.file ?? "", /session\.jsonl/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

ok("표본 29개는 측정 중이고 30개부터 피드백이 열린다", () => {
  const c = emptyCounters();
  c.prompts = MIN_SAMPLE - 1;
  assert.equal(finalize(c).eligible, false);
  c.prompts = MIN_SAMPLE;
  assert.equal(finalize(c).eligible, true);
});

ok("표본이 모자라면 남은 개수만 안내한다", () => {
  const feedback = buildFeedback(sampleMetrics({ prompts: 18, eligible: false }));
  assert.equal(feedback.status, "collecting");
  assert.equal(feedback.remaining, 12);
  assert.match(feedback.cardTip, /COLLECT 12 MORE/);
});

ok("가장 적게 관찰된 습관을 다음 실험으로 고른다", () => {
  const feedback = buildFeedback(sampleMetrics());
  assert.equal(feedback.status, "ready");
  assert.match(feedback.tip, /조건이나 완료 기준/);
  assert.equal(feedback.cardTip, "ADD A CONSTRAINT OR DONE CHECK");
});

ok("통째 위임이 자주 보이면 판단 기준을 함께 적으라고 제안한다", () => {
  const feedback = buildFeedback(sampleMetrics({
    habits: {
      contextRate: 50,
      constraintRate: 50,
      stepRate: 50,
      outsourceRate: 20,
    },
  }));
  assert.match(feedback.tip, /판단 기준/);
});

ok("피드백 카드는 관찰값·표본·자기신고 한계를 그대로 표시한다", () => {
  const svg = renderFeedbackCard({
    username: "tester",
    metrics: sampleMetrics(),
    provenance: "self-reported",
  });
  assert.match(svg, />STRUCTURE<\/text>/);
  assert.match(svg, />42\.3<\/text>/);
  assert.match(svg, />97\.5%<\/text>/);
  assert.match(svg, />CONTEXT<\/text>[\s\S]*>40\.0%<\/text>/);
  assert.match(svg, />CONSTRAINTS<\/text>[\s\S]*>10\.0%<\/text>/);
  assert.match(svg, />STEPS<\/text>[\s\S]*>20\.0%<\/text>/);
  assert.match(svg, />HANDOFF \/ NO RULE<\/text>[\s\S]*>3\.0%<\/text>/);
  assert.match(svg, /N=100 · RULES F1\/M2 · SELF-REPORTED/);
  assert.match(svg, /ADD A CONSTRAINT OR DONE CHECK/);
  assert.doesNotMatch(svg, /\bINTELLECT\b|>\s*KARMA\s*<|ABILITY TEST[^<]*YES/);
});

ok("규칙 버전이 없는 예전 state는 새 규칙으로 가장하지 않는다", () => {
  const svg = renderFeedbackCard({
    username: "legacy-state",
    metrics: sampleMetrics({ metricVersion: undefined, habits: undefined }),
    provenance: "local",
  });
  assert.match(svg, /RULES F1\/M1/);
  assert.match(svg, /DETAIL VIEW NEEDS A FRESH SCAN/);
  assert.match(svg, /RE-SCAN TO UNLOCK 4 HABIT SIGNALS/);
});

ok("모든 카드 스타일은 작은 표본을 COLLECTING으로 낮춘다", () => {
  for (const render of [renderFeedbackCard, renderCard, renderPolytope]) {
    const svg = render({
      username: "new-user",
      metrics: sampleMetrics({ prompts: 29, eligible: false }),
      provenance: "unverified",
    });
    assert.match(svg, /COLLECTING 29\/30/);
    assert.doesNotMatch(svg, />42\.3%<\/text>|AFFIRMING|\bINTELLECT\b|>\s*KARMA\s*</);
    assert.match(svg, /UNVERIFIED URL DATA/);
  }
});

ok("카드 사용자명을 SVG 이스케이프한다", () => {
  const svg = renderFeedbackCard({
    username: `<script>"`,
    metrics: sampleMetrics(),
    provenance: "local",
  });
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;&quot;/);
});

ok("긴 사용자명은 접근성 이름은 보존하고 화면 표시만 줄인다", () => {
  const username = "W".repeat(39);
  const svg = renderFeedbackCard({
    username,
    metrics: sampleMetrics(),
    provenance: "local",
  });
  assert.match(svg, new RegExp(`aria-label="${username} prompt habits feedback"`));
  assert.match(svg, /@W{19}…<\/text>/);
  assert.doesNotMatch(svg, new RegExp(`>@${username}<`));
});

ok("깨진 숫자는 카드에 NaN이나 Infinity로 새지 않는다", () => {
  const svg = renderFeedbackCard({
    username: "broken-input",
    metrics: sampleMetrics({
      prompts: Number.POSITIVE_INFINITY,
      competence: Number.NaN,
      profanityRate: Number.POSITIVE_INFINITY,
      habits: {
        contextRate: Number.NaN,
        constraintRate: Number.POSITIVE_INFINITY,
        stepRate: -10,
        outsourceRate: 120,
      },
    }),
    provenance: "unverified",
  });
  assert.doesNotMatch(svg, /NaN|Infinity/);
  assert.match(svg, /N=0 · RULES F1\/M2/);
});

await okAsync("제출 API는 잘못된 JSON과 GitHub 이름을 DB 전에 거절한다", async () => {
  const call = async (body: unknown) => {
    let status = 0;
    let payload: any;
    const res = {
      status(code: number) { status = code; return this; },
      json(value: unknown) { payload = value; return this; },
    };
    await handleSubmit({ method: "POST", body }, res, async () => {
      throw new Error("잘못된 입력에서 저장을 호출하면 안 됨");
    });
    return { status, payload };
  };
  assert.equal((await call("{")).status, 400);
  const invalid = await call({ u: "bad--name", p: 100 });
  assert.equal(invalid.status, 400);
  assert.match(String(invalid.payload?.error), /GitHub username/);
});

await okAsync("제출 API는 스캔 시각·규칙 버전·세부 습관을 보존한다", async () => {
  let saved: CardWrite | undefined;
  let status = 0;
  const res = {
    status(code: number) { status = code; return this; },
    json() { return this; },
  };
  await handleSubmit({
    method: "POST",
    body: {
      u: "Tester",
      p: 100,
      f: 2.5,
      d: 42.3,
      contextRate: 40,
      constraintRate: 10,
      stepRate: 20,
      outsourceRate: 3,
      scannedAt: "2026-07-29T12:00:00.000Z",
      filterVersion: 1,
      metricVersion: 2,
    },
  }, res, async (row) => { saved = row; });
  assert.equal(status, 200);
  assert.equal(saved?.username, "tester");
  assert.equal(saved?.constraintRate, 10);
  assert.equal(saved?.scannedAt, "2026-07-29T12:00:00.000Z");
  assert.equal(saved?.metricVersion, 2);
});

await okAsync("카드 API는 코치 카드를 기본으로 쓰고 기존 카드는 classic으로 보존한다", async () => {
  const call = async (query: Record<string, unknown>, row: CardRow | null = null) => {
    let status = 0;
    let svg = "";
    const headers = new Map<string, string>();
    const res = {
      setHeader(name: string, value: string) { headers.set(name, value); },
      status(code: number) { status = code; return this; },
      send(value: string) { svg = value; return this; },
    };
    await handleCard({ query }, res, async () => row);
    return { status, svg, headers };
  };
  const feedback = await call({ u: "tester", f: 2.5, d: 42.3, p: 100, mv: 2 });
  assert.equal(feedback.status, 200);
  assert.match(feedback.svg, /width="700" height="300"/);
  assert.match(feedback.svg, /PROMPTKARMA/);
  assert.match(feedback.svg, /DETAIL VIEW NEEDS A FRESH SCAN/);
  assert.match(feedback.svg, /RULES F1\/M2/);
  assert.match(feedback.svg, /UNVERIFIED URL DATA/);
  assert.match(String(feedback.headers.get("Content-Type")), /image\/svg\+xml/);

  for (const style of ["coach", "feedback", "unknown"]) {
    const alias = await call({ u: "tester", f: 2.5, d: 42.3, p: 100, style });
    assert.match(alias.svg, /width="700" height="300"/);
    assert.match(alias.svg, /PROMPTKARMA/);
  }

  const legacy = await call({ u: "tester", f: 2.5, d: 42.3, p: 100, style: "classic" });
  assert.match(legacy.svg, /width="500" height="200"/);
  assert.match(legacy.svg, /no-swear prompts/);
  assert.doesNotMatch(legacy.svg, /intelligence|karma/);

  const empty = await call({ u: "new-user" });
  assert.match(empty.svg, /width="700" height="300"/);
  assert.match(empty.svg, /COLLECTING 0\/30/);
  assert.match(empty.svg, /NO PUBLIC SCAN/);
  assert.doesNotMatch(empty.svg, /AFFIRMING/);

  const stored = await call({ u: "tester", style: "feedback" }, {
    username: "Tester",
    profanity: 2.5,
    competence: 42.3,
    prompts: 100,
    promptsPerSwear: 40,
    praise: 0,
    karma: "white",
    contextRate: 40,
    constraintRate: 10,
    stepRate: 20,
    outsourceRate: 3,
    scannedAt: "2026-07-29T12:00:00.000Z",
    filterVersion: 1,
    metricVersion: 2,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  assert.match(stored.svg, /SELF-REPORTED/);
  assert.match(stored.svg, /SCANNED 2026-07-29/);
  assert.match(stored.svg, /ADD A CONSTRAINT OR DONE CHECK/);

  const inferredM2 = await call({ u: "tester" }, {
    username: "Tester",
    profanity: 2.5,
    competence: 42.3,
    prompts: 100,
    promptsPerSwear: 40,
    praise: 0,
    karma: "white",
    contextRate: 40,
    constraintRate: 10,
    stepRate: 20,
    outsourceRate: 3,
    scannedAt: null,
    filterVersion: 1,
    metricVersion: null,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  assert.match(inferredM2.svg, /RULES F1\/M2/);
  assert.match(inferredM2.svg, />CONTEXT<\/text>/);

  const unavailable = await call({ u: "tester" }, null);
  await handleCard({ query: { u: "tester" } }, {
    setHeader(name: string, value: string) { unavailable.headers.set(name, value); },
    status(code: number) { unavailable.status = code; return this; },
    send(value: string) { unavailable.svg = value; return this; },
  }, async () => { throw new Error("database offline"); });
  assert.match(unavailable.svg, /PUBLIC CARD TEMPORARILY UNAVAILABLE/);
  assert.match(unavailable.svg, /DATA UNAVAILABLE/);
  assert.doesNotMatch(unavailable.svg, /NO PUBLIC SCAN/);
  assert.match(String(unavailable.headers.get("Cache-Control")), /no-store/);
});

ok("랜딩은 모바일 미리보기와 배지 제작 흐름을 계속 노출한다", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="username"/);
  assert.match(html, /data-style="coach"/);
  assert.match(html, /data-style="polytope"/);
  assert.match(html, /data-style="classic"/);
  assert.match(html, /data-theme="cyberpunk"/);
  assert.match(html, /id="copy-markdown"/);
  assert.match(html, /style=coach/);
  assert.match(html, /navigator\.clipboard/);
  assert.doesNotMatch(html, /\.preview\s*\{\s*display:\s*none/);
});

console.log(`\n${checks}개 핵심 검사 통과\n`);
