/**
 * PROMPT POLYTOPE 회귀 테스트. 의존성 없음 — `bun run test`.
 *
 * 지키려는 것:
 *  1) 각 티어가 정말 "정"다면체/정다포체인가 — 꼭짓점 차수·모서리 길이가 전부 같아야 한다.
 *  2) 회전 루프가 이음새 없이 닫히는가 — 마지막 프레임의 그림 = 첫 프레임 그림.
 *  3) 배지로 쓸 수 있는가 — 캔버스·타이틀·패널 침범 없음(회전 반경 포함), 용량 상한, SMIL 미지원 폴백.
 *  4) 티어 매핑·라벨·karma 발산 색이 서로 어긋나지 않는가.
 */
import assert from "node:assert/strict";
import {
  cell3, cell5, cell16, cell8, cell24, cell600, cell120,
  polyEdges, pnormN, pdistN, rotPeriod, renderPolytope,
} from "./card.js";
import type { Metrics } from "./metrics.js";

const mk = (competence: number, profanityRate = 0, praiseRate = 0): Metrics => ({
  prompts: 500, slash: 0, profanityRate, promptsPerSwear: null,
  competence, praiseRate,
  karma: praiseRate > profanityRate ? "cyan" : profanityRate >= 15 ? "black" : "white",
  eligible: true,
});
const EPS = 1e-9;
let checks = 0;
const ok = (label: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${label}`); };

/**
 * 7티어: 3D 정사면체(바닥) + 4D 볼록 정다포체 6종.
 * per = 등각회전이 도형을 자기 자신으로 되돌리는 각. 4D 5종은 π/2, 5-cell·사면체는 2π.
 * c = 그 티어가 나오는 대표 INTELLECT 값(INTEL_CUTS = [18,34,46,56,68,84] 기준).
 */
const HALF = Math.PI / 2, FULL = 2 * Math.PI;
const SOLIDS = [
  { name: "사면체   {3,3}",   gen: cell3,   v: 4,   e: 6,    deg: 3,  dim: 3, per: FULL, c: 5 },
  { name: "5-cell   {3,3,3}", gen: cell5,   v: 5,   e: 10,   deg: 4,  dim: 4, per: FULL, c: 25 },
  { name: "16-cell  {3,3,4}", gen: cell16,  v: 8,   e: 24,   deg: 6,  dim: 4, per: HALF, c: 40 },
  { name: "8-cell   {4,3,3}", gen: cell8,   v: 16,  e: 32,   deg: 4,  dim: 4, per: HALF, c: 51 },
  { name: "24-cell  {3,4,3}", gen: cell24,  v: 24,  e: 96,   deg: 8,  dim: 4, per: HALF, c: 60 },
  { name: "600-cell {3,3,5}", gen: cell600, v: 120, e: 720,  deg: 12, dim: 4, per: HALF, c: 75 },
  { name: "120-cell {5,3,3}", gen: cell120, v: 600, e: 1200, deg: 4,  dim: 4, per: HALF, c: 95 },
];

// ---------------------------------------------------------------- 1. 정규성
console.log("정규성 (3D 정사면체 + 4D 정다포체 6종 — 4D에는 이 6종뿐)");
for (const { name, gen, v, e, deg } of SOLIDS) {
  ok(`${name}: ${v}정점 ${e}모서리, 차수 ${deg}`, () => {
    const V = gen().map(pnormN);
    const E = polyEdges(V);
    assert.equal(V.length, v, `${name}: 정점 수`);
    assert.equal(E.length, e, `${name}: 모서리 수`);
    const d = new Array<number>(V.length).fill(0);
    for (const [a, b] of E) { d[a]!++; d[b]!++; }
    assert.ok(d.every((x) => x === deg), `${name}: 차수가 전부 ${deg} (실제 ${Math.min(...d)}~${Math.max(...d)})`);
    const lens = E.map(([a, b]) => pdistN(V[a]!, V[b]!));
    assert.ok(Math.max(...lens) - Math.min(...lens) < EPS, `${name}: 모서리 길이가 전부 같아야 한다`);
    const norms = V.map((x) => Math.hypot(...x));
    assert.ok(Math.max(...norms) - Math.min(...norms) < EPS, `${name}: 정점이 전부 외접구 위에`);
  });
}
ok("600-cell 모서리 길이 = 1/φ (황금비)", () => {
  const V = cell600().map(pnormN);
  const [a, b] = polyEdges(V)[0]!;
  assert.ok(Math.abs(pdistN(V[a]!, V[b]!) - 2 / (1 + Math.sqrt(5))) < EPS);
});
ok("4D 도형의 회전 주기가 기댓값과 정확히 일치한다", () => {
  // rotPeriod는 rot4(4D 회전)를 쓰므로 4D 도형만. 사면체는 3D라 sweep=2π 고정(코드가 그렇게 분기).
  for (const { name, gen, per, dim } of SOLIDS)
    if (dim === 4) assert.equal(rotPeriod(gen().map(pnormN)), per, `${name}: 회전 주기`);
});
ok("rotPeriod가 π 주기 도형도 짚어낸다", () => {
  const V = cell5().map(pnormN);
  assert.equal(rotPeriod([...V, ...V.map((v) => v.map((x) => -x))]), Math.PI);
});

// -------------------------------------------------------- 프레임 파싱 헬퍼
/** 선분 하나를 방향 무관하게 정규화(루프 끝에서 정점 자리 바뀜 대비). */
const seg = (x1: string, y1: string, x2: string, y2: string) => [`${x1},${y1}`, `${x2},${y2}`].sort().join("|");
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
function pathFrames(svg: string): string[][] {
  const m = svg.match(/attributeName="d"[^>]*values="([^"]*)"/);
  if (!m) return [];
  return m[1]!.split(";").map((frame) =>
    [...frame.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((s) => seg(s[1]!, s[2]!, s[3]!, s[4]!)).sort()
  );
}
const frameSets = (svg: string) => { const p = pathFrames(svg); return p.length ? p : lineFrames(svg); };
const dots = (svg: string) => (svg.match(/<circle r="2\.4"/g) ?? []).length;
const render = (c: number, prof = 0, praise = 0) => renderPolytope({ username: "tester", metrics: mk(c, prof, praise) });

// -------------------------------------------------------- 2. 렌더·티어 매핑
console.log("\n레벨별 렌더 (level = INTELLECT ≥ 각 컷의 개수, 컷 [18,34,46,56,68,84])");
for (const [i, { name, v, e, c }] of SOLIDS.entries()) {
  ok(`L${i} ${name}: 모서리 ${e}개`, () => {
    const svg = render(c);
    const frames = frameSets(svg);
    assert.ok(frames.length > 1, `${name}: 애니메이션 프레임 있어야`);
    assert.equal(frames[0]!.length, e, `${name}: 렌더된 모서리 수`);
    assert.equal(dots(svg), v > 60 ? 0 : v, `${name}: 정점 점 수`);
    assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), `${name}: SVG 봉인`);
  });
}
ok("INTELLECT 밴드가 7티어와 정확히 대응한다", () => {
  const bands: [number, number, number][] = [   // [시작, 끝, 기대 레벨]
    [0, 17, 0], [18, 33, 1], [34, 45, 2], [46, 55, 3], [56, 67, 4], [68, 83, 5], [84, 100, 6],
  ];
  for (const [lo, hi, lv] of bands)
    for (const intel of [lo, hi]) {
      const got = frameSets(render(intel))[0]!.length;
      assert.equal(got, SOLIDS[lv]!.e, `INTELLECT ${intel} → L${lv} ${SOLIDS[lv]!.name}(모서리 ${SOLIDS[lv]!.e}) 인데 ${got}`);
    }
});
ok("사다리가 복잡도 순으로 단조 증가한다", () => {
  const counts = SOLIDS.map(({ c }) => frameSets(render(c))[0]!.length);
  for (let i = 1; i < counts.length; i++)
    assert.ok(counts[i]! > counts[i - 1]!, `L${i}(${counts[i]})가 L${i - 1}(${counts[i - 1]})보다 복잡해야`);
});

// ------------------------------------------------------- 3. 루프·레이아웃
console.log("\n회전 루프·레이아웃·무게");
for (const [i, { name, c }] of SOLIDS.entries())
  ok(`L${i} ${name}: 루프가 이음새 없이 닫힌다`, () => {
    const f = frameSets(render(c));
    assert.deepEqual(f.at(-1), f[0], `${name}: 마지막 프레임 = 첫 프레임`);
  });
ok("턴테이블: 글리프 전체가 1바퀴/분 돈다", () => {
  for (const { name, c } of SOLIDS) {
    const svg = render(c);
    assert.match(svg, /<animateTransform[^>]*type="rotate"[^>]*dur="60s"[^>]*repeatCount="indefinite"/, `${name}: 턴테이블 없음`);
    assert.match(svg, /from="0 210 156" to="360 210 156"/, `${name}: 중심 기준 0→360° 아님`);
  }
});
ok("회전 반경이 캔버스·타이틀·패널을 침범하지 않는다", () => {
  // 턴테이블은 중심에서 가장 먼 점을 반경으로 원을 그린다. 그 원이 다 들어가야 한다.
  const cx = 210, cy = 156;
  for (const { name, c } of SOLIDS) {
    let R = 0;
    for (const frame of frameSets(render(c)))
      for (const s of frame)
        for (const pt of s.split("|")) {
          const [x, y] = pt.split(",").map(Number);
          R = Math.max(R, Math.hypot(x! - cx, y! - cy));
        }
    assert.ok(cx - R > 4 && cx + R < 422, `${name}: 회전 가로 [${(cx - R).toFixed(0)}..${(cx + R).toFixed(0)}]`);
    assert.ok(cy - R > 41 && cy + R < 296, `${name}: 회전 세로 [${(cy - R).toFixed(0)}..${(cy + R).toFixed(0)}] (위>41 타이틀)`);
  }
});
ok("어느 티어도 160KB를 넘지 않는다", () => {
  for (const { name, c } of SOLIDS)
    assert.ok(Buffer.byteLength(render(c), "utf8") / 1024 < 160, `${name} 카드가 ${(Buffer.byteLength(render(c), "utf8") / 1024).toFixed(1)}KB`);
});
ok("모든 티어가 SMIL 없이도 그려진다 (정적 좌표 폴백)", () => {
  for (const { name, c, v } of SOLIDS) {
    const svg = render(c);
    if (v > 60) assert.match(svg, /<path[^>]*\sd="M[^"]+"/, `${name}: path 기본 d 없음`);
    else {
      assert.match(svg, /<line[^>]*\sx1="[-\d.]+"[^>]*\sy1="[-\d.]+"[^>]*\sx2="[-\d.]+"[^>]*\sy2="[-\d.]+"/, `${name}: line 기본 좌표 없음`);
      assert.match(svg, /<circle[^>]*\scx="[-\d.]+"[^>]*\scy="[-\d.]+"/, `${name}: circle 기본 좌표 없음`);
    }
  }
});
ok("모프 각속도가 티어마다 같고, 정점이 프레임당 최소 0.15px 움직인다", () => {
  const rates = SOLIDS.map(({ name, c, per }) => {
    const dur = +render(c).match(/<animate [^>]*dur="([\d.]+)s"/)![1]!;   // 모프 dur (턴테이블 60s 아님)
    return { name, deg: (per * (180 / Math.PI)) / dur };
  });
  for (const r of rates)
    assert.ok(Math.abs(r.deg - rates[0]!.deg) < 0.05, `${r.name}: ${r.deg.toFixed(2)}°/s (기준 ${rates[0]!.deg.toFixed(2)})`);
  for (const { name, c } of SOLIDS) {
    const svg = render(c);
    const dur = +svg.match(/<animate [^>]*dur="([\d.]+)s"/)![1]!;
    const frames = frameSets(svg);
    let maxStep = 0;
    for (let f = 1; f < frames.length; f++)
      for (let i = 0; i < frames[f]!.length; i++) {
        const pt = (s: string) => s.split("|")[0]!.split(",").map(Number);
        const [x0, y0] = pt(frames[f - 1]![i]!), [x1, y1] = pt(frames[f]![i]!);
        maxStep = Math.max(maxStep, Math.hypot(x1! - x0!, y1! - y0!));
      }
    const perFrame = maxStep / ((dur / (frames.length - 1)) * 60);
    assert.ok(perFrame >= 0.15, `${name}: 프레임당 ${perFrame.toFixed(3)}px — 너무 느려 끊겨 보인다`);
  }
});

// ------------------------------------------------------- 4. 관찰 라벨·색
console.log("\n관찰 라벨·색");
const intelWord = (svg: string) => svg.match(/font-size="11"[^>]*>([^<]+)</)![1]!;
const karmaWord = (svg: string) => [...svg.matchAll(/font-size="11"[^>]*>([^<]+)</g)][1]![1]!;
const glyphColor = (svg: string) => svg.match(/<line stroke="#([0-9a-f]{6})"/)![1]!;
const rgb = (hex: string) => [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];

ok("패널 텍스트가 같은 줄에서 겹치지 않는다", () => {
  const ADV = 0.6;
  for (const c of [5, 40, 60, 95]) {
    const svg = render(c);
    const texts = [...svg.matchAll(/<text\s([^>]*)>([^<]*)<\/text>/g)].map((m) => {
      const at = (n: string) => m[1]!.match(new RegExp(`${n}="([^"]*)"`))?.[1];
      const x = +at("x")!, fs = +(at("font-size") ?? 12), ls = +(at("letter-spacing") ?? 0);
      const w = m[2]!.length * (fs * ADV + ls), anchor = at("text-anchor") ?? "start";
      const lo = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      return { row: Math.round(+at("y")! / 20), lo, hi: lo + w, s: m[2]! };
    }).filter((t) => t.lo >= 400);
    for (const t of texts) for (const u of texts) {
      if (t === u || t.row !== u.row) continue;
      assert.ok(Math.min(t.hi, u.hi) - Math.max(t.lo, u.lo) <= 0, `INTELLECT=${c}: "${t.s}"와 "${u.s}" 겹침`);
    }
  }
});
ok("티어 이름이 INTELLECT 밴드와 함께 바뀐다", () => {
  assert.equal(intelWord(render(46)), intelWord(render(55)), "46~55는 같은 단어");
  assert.notEqual(intelWord(render(56)), intelWord(render(55)), "55→56 단어 바뀜");
  assert.equal(intelWord(render(5)), "CHAOTIC", "바닥은 CHAOTIC");
  assert.equal(intelWord(render(95)), "EXACTING", "최상은 EXACTING");
});
ok("KARMA 색은 욕설률 20%=따뜻, 10%=중립, 0%=차가움이다", () => {
  const warm = rgb(glyphColor(render(60, 20)));
  const mid = rgb(glyphColor(render(60, 10)));
  const cool = rgb(glyphColor(render(60, 0)));
  assert.ok(warm[0]! - warm[2]! > 40, `욕설률 20%는 따뜻해야(R≫B): ${warm}`);
  assert.ok(cool[2]! - cool[0]! > 40, `욕설 탐지 0%는 차가워야(B≫R): ${cool}`);
  assert.ok(Math.abs(mid[0]! - mid[2]!) < 40, `중립이 회색이어야(R≈B): ${mid}`);
});
ok("다포체 카드가 원래 두 축과 등급 이름을 표시한다", () => {
  const svg = render(60, 20);
  assert.equal(karmaWord(svg), "CAUSTIC");
  assert.match(svg, /PROMPT POLYTOPE|INTELLECT|KARMA|STRUCTURED|CAUSTIC/);
  assert.match(svg, /SELF-REPORTED|UNVERIFIED URL DATA|LOCAL SCAN/);
});
ok("칭찬>욕일 때만 발광 코어가 켜진다", () => {
  assert.match(render(60, 0, 20), /attributeName="opacity" dur="3.5s"/, "칭찬>욕 → 발광 ON");
  assert.doesNotMatch(render(60, 5, 0), /attributeName="opacity" dur="3.5s"/, "칭찬 없음 → 발광 off");
});

console.log(`\n${checks}개 검사 통과\n`);
for (const [i, { name, gen, e, c, dim }] of SOLIDS.entries()) {
  const kb = (Buffer.byteLength(render(c), "utf8") / 1024).toFixed(1).padStart(6);
  const per = dim === 4 ? (rotPeriod(gen().map(pnormN)) / Math.PI).toFixed(2) : "2.00";
  console.log(`  L${i}  ${name}  ${String(e).padStart(4)}모서리  ${kb}KB  회전주기 ${per}π`);
}
