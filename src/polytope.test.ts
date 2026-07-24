/**
 * 다면체·정다포체 회귀 테스트. 의존성 없음 — `bun run src/polytope.test.ts`.
 *
 * 지키려는 것 두 가지:
 *  1) 각 레벨이 "정"다면체/정다포체인가 — 모든 꼭짓점의 차수가 같고 모든 모서리 길이가 같아야 한다.
 *     polyEdges의 최소거리 임계(1.12)를 건드리면 여기서 깨진다.
 *  2) 4D 회전 루프가 이음새 없이 닫히는가 — 마지막 프레임의 그림이 첫 프레임과 같아야 한다.
 *     4D 등각회전은 π/2 주기라 SWEEP을 2π로 되돌리면 프레임 3/4이 중복되고, 반대로
 *     주기가 아닌 각도로 바꾸면 루프에서 그림이 튄다.
 */
import assert from "node:assert/strict";
import { cell24, cell600, polyEdges, pnormN, pdistN, renderPolytope } from "./card.js";
import type { Metrics } from "./metrics.js";

const mk = (competence: number): Metrics => ({
  prompts: 500, slash: 0, profanityRate: 0, promptsPerSwear: null,
  competence, praiseRate: 0, karma: "cyan", eligible: true,
});
const EPS = 1e-9;
let checks = 0;
const ok = (label: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${label}`); };

// ---------------------------------------------------------------- 1. 정규성
function assertRegular(name: string, raw: number[][], expV: number, expE: number, expDeg: number) {
  const V = raw.map(pnormN);
  const E = polyEdges(V, 1);
  assert.equal(V.length, expV, `${name}: 정점 수`);
  assert.equal(E.length, expE, `${name}: 모서리 수`);

  const deg = new Array<number>(V.length).fill(0);
  for (const [a, b] of E) { deg[a]!++; deg[b]!++; }
  assert.ok(deg.every((d) => d === expDeg), `${name}: 모든 꼭짓점 차수가 ${expDeg}이어야 한다 (실제 ${Math.min(...deg)}~${Math.max(...deg)})`);

  const lens = E.map(([a, b]) => pdistN(V[a]!, V[b]!));
  assert.ok(Math.max(...lens) - Math.min(...lens) < EPS, `${name}: 모든 모서리 길이가 같아야 한다`);

  const norms = V.map((v) => Math.hypot(...v));
  assert.ok(Math.max(...norms) - Math.min(...norms) < EPS, `${name}: 모든 정점이 외접구 위에 있어야 한다`);
}

console.log("4D 볼록 정다포체 — 정규성");
ok("24-cell {3,4,3}: 24정점 96모서리, 차수 8", () => assertRegular("24-cell", cell24(), 24, 96, 8));
ok("600-cell {3,3,5}: 120정점 720모서리, 차수 12", () => assertRegular("600-cell", cell600(), 120, 720, 12));
ok("600-cell 모서리 길이 = 1/φ", () => {
  const V = cell600().map(pnormN);
  const [a, b] = polyEdges(V, 1)[0]!;
  assert.ok(Math.abs(pdistN(V[a]!, V[b]!) - 2 / (1 + Math.sqrt(5))) < EPS);
});

// ------------------------------------------------- 2. 렌더된 레벨별 도형 수
/**
 * 선분 하나를 방향 무관하게 정규화한다("x1,y1|x2,y2", 두 끝점을 정렬).
 * 회전 루프의 마지막 프레임에서는 정점끼리 자리를 바꾸므로 같은 선분이 반대 방향으로
 * 기록될 수 있다 — 그림은 같다. 끝점 순서까지 비교하면 유령 실패가 난다.
 */
const seg = (x1: string, y1: string, x2: string, y2: string) => [`${x1},${y1}`, `${x2},${y2}`].sort().join("|");

/** per-endpoint(<line>) 레벨의 프레임별 선분 집합. */
function lineFrames(svg: string): string[][] {
  const vals = (block: string, attr: string) =>
    block.match(new RegExp(`attributeName="${attr}"[^>]*values="([^"]*)"`))![1]!.split(";");
  const blocks = [...svg.matchAll(/<line[^>]*>[\s\S]*?<\/line>/g)].map((m) => m[0]);
  if (blocks.length === 0) return [];
  const n = vals(blocks[0]!, "x1").length;
  return Array.from({ length: n }, (_, f) =>
    blocks.map((b) => seg(vals(b, "x1")[f]!, vals(b, "y1")[f]!, vals(b, "x2")[f]!, vals(b, "y2")[f]!)).sort()
  );
}
/** heavy(단일 <path> d 모프) 레벨의 프레임별 선분 집합. */
function pathFrames(svg: string): string[][] {
  const m = svg.match(/attributeName="d"[^>]*values="([^"]*)"/);
  if (!m) return [];
  return m[1]!.split(";").map((frame) =>
    [...frame.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)]
      .map((s) => seg(s[1]!, s[2]!, s[3]!, s[4]!)).sort()
  );
}
const frameSets = (svg: string) => { const p = pathFrames(svg); return p.length ? p : lineFrames(svg); };
const circles = (svg: string) => (svg.match(/<circle r="2\.4"/g) ?? []).length;

// competence → level = round(c/100*7)
const LEVELS: { c: number; name: string; v: number; e: number }[] = [
  { c: 0,   name: "정삼각형",   v: 3,   e: 3 },
  { c: 14,  name: "정사각형",   v: 4,   e: 4 },
  { c: 28,  name: "정사면체",   v: 4,   e: 6 },
  { c: 43,  name: "정팔면체",   v: 6,   e: 12 },
  { c: 57,  name: "정육면체",   v: 8,   e: 12 },
  { c: 71,  name: "정이십면체", v: 12,  e: 30 },
  { c: 86,  name: "24-cell",    v: 24,  e: 96 },
  { c: 100, name: "600-cell",   v: 120, e: 720 },
];

console.log("\n레벨별 렌더");
for (const { c, name, v, e } of LEVELS) {
  ok(`L${Math.round((c / 100) * 7)} ${name}: 모서리 ${e}개`, () => {
    const svg = renderPolytope({ username: "tester", metrics: mk(c) });
    const frames = frameSets(svg);
    assert.ok(frames.length > 1, `${name}: 애니메이션 프레임이 있어야 한다`);
    assert.equal(frames[0]!.length, e, `${name}: 모서리 수`);
    // 정점 점은 조밀 메시(600-cell)에서만 생략한다 — 그 외 레벨은 전 정점을 찍는다.
    assert.equal(circles(svg), v > 60 ? 0 : v, `${name}: 정점 점 수`);
    assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), `${name}: SVG 봉인`);
  });
}

// --------------------------------------- 3. 루프 이음새 (4D π/2 주기의 근거)
console.log("\n회전 루프");
for (const { c, name } of LEVELS) {
  ok(`${name}: 마지막 프레임 그림 = 첫 프레임 그림`, () => {
    const frames = frameSets(renderPolytope({ username: "tester", metrics: mk(c) }));
    assert.deepEqual(frames.at(-1), frames[0], `${name}: 루프가 이음새 없이 닫혀야 한다`);
  });
}

// ------------------------------------------------ 4. 캔버스·패널 침범, 무게
console.log("\n레이아웃·무게");
for (const { c, name } of LEVELS) {
  ok(`${name}: 글리프가 캔버스 안, 데이터 패널(x≥422) 밖`, () => {
    const svg = renderPolytope({ username: "tester", metrics: mk(c) });
    const xs: number[] = [], ys: number[] = [];
    for (const frame of frameSets(svg))
      for (const s of frame)
        for (const pt of s.split("|")) {
          const [x, y] = pt.split(",").map(Number);
          xs.push(x!); ys.push(y!);
        }
    assert.ok(Math.min(...xs) > 4 && Math.max(...xs) < 422, `${name}: x 범위 ${Math.min(...xs)}~${Math.max(...xs)}`);
    assert.ok(Math.min(...ys) > 4 && Math.max(...ys) < 296, `${name}: y 범위 ${Math.min(...ys)}~${Math.max(...ys)}`);
  });
}
ok("최상위 티어 SVG가 200KB 미만 (README 배지로 쓸 수 있어야 한다)", () => {
  const kb = Buffer.byteLength(renderPolytope({ username: "tester", metrics: mk(100) }), "utf8") / 1024;
  assert.ok(kb < 200, `600-cell 카드가 ${kb.toFixed(1)}KB`);
});
ok("heavy 레벨에 정적 d 폴백이 있다 (SMIL 미지원 렌더러 대비)", () => {
  const svg = renderPolytope({ username: "tester", metrics: mk(100) });
  assert.match(svg, /<path[^>]*\sd="M[^"]+"/, "600-cell path에 기본 d가 없다");
});

console.log(`\n${checks}개 검사 통과`);
