import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleCard } from "../api/card.js";
import { handleSubmit } from "../api/submit.js";
import { renderCard, renderPolytope } from "./card.js";
import type { CardRow, CardWrite } from "./db.js";
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
import { scan } from "./scan.js";
import { isStructured } from "./signals.js";

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
  slash: 10,
  profanityRate: 2.5,
  promptsPerSwear: 40,
  competence: 42.3,
  praiseRate: 0,
  karma: "white",
  eligible: true,
  ...overrides,
});

console.log("핵심 지표·배지 회귀 검사");

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

ok("파일·조건·목록은 구조 신호로 잡고 일반 문장은 잡지 않는다", () => {
  assert.equal(isStructured("src/index.ts를 고쳐. 반드시 테스트해.\n- 구현\n- 검사"), true);
  assert.equal(isStructured("https://example.com 문서를 봐줘"), true);
  assert.equal(isStructured("계속 진행해"), false);
});

ok("M3 INTELLECT는 구조 입력과 슬래시커맨드를 함께 센다", () => {
  const c = emptyCounters();
  accumulate(c, prompt("src/index.ts를 고쳐"));
  accumulate(c, prompt("계속 진행해"));
  accumulate(c, { ...prompt("/help"), kind: "slash" });
  const m = finalize(c);
  assert.equal(m.metricVersion, 3);
  assert.equal(m.prompts, 2);
  assert.equal(m.slash, 1);
  assert.ok(Math.abs(m.competence - 66.6666666667) < 1e-8);
});

ok("표본 29개는 숨기고 30개부터 배지를 연다", () => {
  const c = emptyCounters();
  c.prompts = MIN_SAMPLE - 1;
  assert.equal(finalize(c).eligible, false);
  c.prompts = MIN_SAMPLE;
  assert.equal(finalize(c).eligible, true);
});

ok("스캔은 같은 UUID를 한 번만 센다", () => {
  const dir = mkdtempSync(join(tmpdir(), "promptkarma-test-"));
  try {
    const line = JSON.stringify({
      type: "user",
      userType: "external",
      entrypoint: "cli",
      uuid: "same-turn",
      message: { content: "src/index.ts를 고쳐" },
    });
    writeFileSync(join(dir, "session.jsonl"), `${line}\n${line}\n`);
    const result = scan(dir);
    assert.equal(result.metrics.prompts, 1);
    assert.equal(result.duplicatesSkipped, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

ok("다포체 배지는 원래 두 축·등급·출처를 표시한다", () => {
  const svg = renderPolytope({
    username: "tester",
    metrics: sampleMetrics(),
    provenance: "self-reported",
    filterVersion: 1,
  });
  assert.match(svg, /PROMPT POLYTOPE/);
  assert.match(svg, />INTELLECT<\/text>/);
  assert.match(svg, />KARMA<\/text>/);
  assert.match(svg, />LOOSE<\/text>/);
  assert.match(svg, /N=100 · RULES F1\/M3 · SELF-REPORTED/);
  assert.doesNotMatch(svg, /NEXT MOVE|TRY NEXT|PERSONAL PROMPT SIGNALS|SIGNAL MIX/);
});

ok("Classic 배지는 KARMA와 INTELLECT 게이지를 표시한다", () => {
  const svg = renderCard({
    username: "tester",
    metrics: sampleMetrics(),
    provenance: "local",
  });
  assert.match(svg, />promptkarma<\/text>/);
  assert.match(svg, />KARMA<\/text>/);
  assert.match(svg, />INTELLECT<\/text>/);
  assert.match(svg, />88%<\/text>/);
  assert.match(svg, /LOCAL SCAN/);
});

ok("모든 배지 스타일은 작은 표본에서 점수를 숨긴다", () => {
  for (const render of [renderCard, renderPolytope]) {
    const svg = render({
      username: "new-user",
      metrics: sampleMetrics({ prompts: 29, eligible: false }),
      provenance: "unverified",
    });
    assert.match(svg, /SAMPLE 29\/30/);
    assert.match(svg, /UNVERIFIED URL DATA/);
    assert.doesNotMatch(svg, />42\.3|>88<|>97<|AFFIRMING|CHAOTIC/);
  }
});

ok("배지 사용자명을 SVG 이스케이프한다", () => {
  for (const render of [renderCard, renderPolytope]) {
    const svg = render({
      username: `<script>"`,
      metrics: sampleMetrics(),
      provenance: "local",
    });
    assert.doesNotMatch(svg, /<script>/);
    assert.match(svg, /&lt;SCRIPT&gt;&quot;|&lt;script&gt;&quot;/);
  }
});

ok("긴 사용자명은 접근성 이름은 보존하고 화면 표시만 줄인다", () => {
  const username = "W".repeat(39);
  const svg = renderPolytope({
    username,
    metrics: sampleMetrics(),
    provenance: "local",
  });
  assert.match(svg, new RegExp(`aria-label="${username} prompt polytope"`));
  assert.match(svg, /W{23}… \/ PROMPT POLYTOPE/);
  assert.doesNotMatch(svg, new RegExp(`>${username} /`));
});

ok("깨진 숫자는 배지에 NaN이나 Infinity로 새지 않는다", () => {
  for (const render of [renderCard, renderPolytope]) {
    const svg = render({
      username: "broken-input",
      metrics: sampleMetrics({
        prompts: Number.POSITIVE_INFINITY,
        competence: Number.NaN,
        profanityRate: Number.POSITIVE_INFINITY,
      }),
      provenance: "unverified",
    });
    assert.doesNotMatch(svg, /NaN|Infinity/);
    assert.match(svg, /N=0 · RULES F1\/M3/);
  }
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

await okAsync("제출 API는 두 축과 출처 정보만 보존한다", async () => {
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
      metricVersion: 3,
    },
  }, res, async (row) => { saved = row; });
  assert.equal(status, 200);
  assert.equal(saved?.username, "tester");
  assert.equal(saved?.competence, 42.3);
  assert.equal(saved?.scannedAt, "2026-07-29T12:00:00.000Z");
  assert.equal(saved?.metricVersion, 3);
  assert.equal(Object.hasOwn(saved ?? {}, "contextRate"), false);
});

await okAsync("카드 API는 원래 라우팅과 예전 URL 호환을 함께 지킨다", async () => {
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

  const classic = await call({ u: "tester", f: 2.5, d: 42.3, p: 100, style: "classic" });
  assert.equal(classic.status, 200);
  assert.match(classic.svg, /width="500" height="200"/);
  assert.match(classic.svg, />KARMA<\/text>[\s\S]*>INTELLECT<\/text>/);

  for (const style of [undefined, "polytope", "badge", "coach", "feedback", "unknown"]) {
    const polytope = await call({ u: "tester", f: 2.5, d: 42.3, p: 100, style });
    assert.match(polytope.svg, /width="700" height="300"/);
    assert.match(polytope.svg, /PROMPT POLYTOPE|INTELLECT|KARMA/);
    assert.doesNotMatch(polytope.svg, /NEXT MOVE|TRY NEXT|SIGNAL MIX/);
  }

  const stored = await call({ u: "tester", style: "polytope" }, {
    username: "Tester",
    profanity: 2.5,
    competence: 42.3,
    prompts: 100,
    promptsPerSwear: 40,
    praise: 0,
    karma: "white",
    scannedAt: "2026-07-29T12:00:00.000Z",
    filterVersion: 1,
    metricVersion: 2,
    updatedAt: "2026-07-30T12:00:00.000Z",
  });
  assert.match(stored.svg, /RULES F1\/M2 · SELF-REPORTED · SCANNED 2026-07-29/);

  const empty = await call({ u: "new-user", style: "polytope" });
  assert.match(empty.svg, /NO PUBLIC BADGE/);
  assert.match(empty.svg, /NO PUBLIC SCAN/);
  assert.doesNotMatch(empty.svg, /CHAOTIC|AFFIRMING/);

  const unavailable = await call({ u: "tester", style: "polytope" });
  await handleCard({ query: { u: "tester", style: "polytope" } }, {
    setHeader(name: string, value: string) { unavailable.headers.set(name, value); },
    status(code: number) { unavailable.status = code; return this; },
    send(value: string) { unavailable.svg = value; return this; },
  }, async () => { throw new Error("database offline"); });
  assert.match(unavailable.svg, /PUBLIC BADGE TEMPORARILY UNAVAILABLE/);
  assert.match(unavailable.svg, /DATA UNAVAILABLE/);
  assert.doesNotMatch(unavailable.svg, /NO PUBLIC SCAN/);
  assert.match(String(unavailable.headers.get("Cache-Control")), /no-store/);
  assert.match(String(unavailable.headers.get("Content-Type")), /image\/svg\+xml/);
});

ok("랜딩과 공개 문서에는 배지 중심 흐름만 남는다", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const pkg = readFileSync(new URL("../package.json", import.meta.url), "utf8");
  for (const content of [html, readme, pkg]) {
    assert.doesNotMatch(content, /NEXT MOVE|TRY NEXT|PERSONAL PROMPT SIGNALS|prompt habit|다음에 해볼|다음 행동|습관|코치/i);
  }
  assert.match(html, /data-style="polytope"/);
  assert.match(html, /data-style="classic"/);
  assert.doesNotMatch(html, /data-style="coach"/);
  assert.match(html, /KARMA × INTELLECT/);
  assert.match(html, /id="copy-markdown"/);
  assert.match(html, /navigator\.clipboard/);
  assert.match(readme, /public\/badge-sample\.svg/);
  assert.match(pkg, /"version": "0\.0\.3"/);
});

console.log(`\n${checks}개 핵심 검사 통과\n`);
