/**
 * 4차원 볼록 정다포체 회귀 테스트. 의존성 없음 — `bun run test`.
 *
 * 지키려는 것 셋:
 *  1) 6종이 정말 "정"다포체인가 — 모든 꼭짓점의 차수가 같고 모든 모서리 길이가 같아야 한다.
 *     polyEdges의 최소거리 임계(1.12)나 좌표를 건드리면 여기서 깨진다.
 *  2) 회전 루프가 이음새 없이 닫히는가 — 마지막 프레임의 그림이 첫 프레임과 같아야 한다.
 *     rotPeriod가 틀린 각을 주면 루프에서 그림이 튄다.
 *  3) 배지로 쓸 수 있는가 — 캔버스·패널 침범 없음, 용량 상한, SMIL 미지원 폴백.
 */
import assert from "node:assert/strict";
import {
  cell5, cell16, cell8, cell24, cell600, cell120,
  polyEdges, pnormN, pdistN, rotPeriod, renderPolytope,
} from "./card.js";
import type { Metrics } from "./metrics.js";

const mk = (competence: number): Metrics => ({
  prompts: 500, slash: 0, profanityRate: 0, promptsPerSwear: null,
  competence, praiseRate: 0, karma: "cyan", eligible: true,
});
const EPS = 1e-9;
let checks = 0;
const ok = (label: string, fn: () => void) => { fn(); checks++; console.log(`  ok  ${label}`); };

/** 4D 볼록 정다포체 6종 — 슐레플리 기호, 정점·모서리 수, 꼭짓점 차수. */
const HALF = Math.PI / 2, FULL = 2 * Math.PI;
const SOLIDS = [
  // per = 등각회전이 도형을 자기 자신으로 되돌리는 각. 5-cell만 2π다 —
  // rot4(v,π/2)는 부호 붙은 짝치환 (0 3)(1 2)이라 "순열×부호 전체" 궤도로 만든 5종은 보존되지만,
  // 단체(simplex)인 5-cell의 회전대칭군 A5에는 위수 4 원소가 없어 π/2로 돌아오지 않는다.
  { name: "5-cell   {3,3,3}", gen: cell5,   v: 5,   e: 10,   deg: 4,  c: 0,   per: FULL },
  { name: "16-cell  {3,3,4}", gen: cell16,  v: 8,   e: 24,   deg: 6,  c: 20,  per: HALF },
  { name: "8-cell   {4,3,3}", gen: cell8,   v: 16,  e: 32,   deg: 4,  c: 40,  per: HALF },
  { name: "24-cell  {3,4,3}", gen: cell24,  v: 24,  e: 96,   deg: 8,  c: 60,  per: HALF },
  { name: "600-cell {3,3,5}", gen: cell600, v: 120, e: 720,  deg: 12, c: 80,  per: HALF },
  { name: "120-cell {5,3,3}", gen: cell120, v: 600, e: 1200, deg: 4,  c: 100, per: HALF },
];

// ---------------------------------------------------------------- 1. 정규성
console.log("4차원 볼록 정다포체 — 정규성 (4D에는 이 6종뿐이다)");
for (const { name, gen, v, e, deg } of SOLIDS) {
  ok(`${name}: ${v}정점 ${e}모서리, 차수 ${deg}`, () => {
    const V = gen().map(pnormN);
    const E = polyEdges(V);
    assert.equal(V.length, v, `${name}: 정점 수`);
    assert.equal(E.length, e, `${name}: 모서리 수`);

    const d = new Array<number>(V.length).fill(0);
    for (const [a, b] of E) { d[a]!++; d[b]!++; }
    assert.ok(d.every((x) => x === deg), `${name}: 차수가 전부 ${deg}이어야 한다 (실제 ${Math.min(...d)}~${Math.max(...d)})`);

    const lens = E.map(([a, b]) => pdistN(V[a]!, V[b]!));
    assert.ok(Math.max(...lens) - Math.min(...lens) < EPS, `${name}: 모서리 길이가 전부 같아야 한다`);

    const norms = V.map((x) => Math.hypot(...x));
    assert.ok(Math.max(...norms) - Math.min(...norms) < EPS, `${name}: 정점이 전부 외접구 위에 있어야 한다`);
  });
}
ok("600-cell 모서리 길이 = 1/φ (황금비)", () => {
  const V = cell600().map(pnormN);
  const [a, b] = polyEdges(V)[0]!;
  assert.ok(Math.abs(pdistN(V[a]!, V[b]!) - 2 / (1 + Math.sqrt(5))) < EPS);
});
ok("회전 주기가 도형별 기댓값과 정확히 일치한다", () => {
  // rotPeriod는 구조상 π/2·π·2π 중 하나만 반환하므로 "셋 중 하나인가"는 항진명제다.
  // 값 자체를 못박아야 기하가 바뀌었을 때 잡힌다(주기가 길어지면 프레임 중복, 짧아지면 루프에서 튄다).
  for (const { name, gen, per } of SOLIDS)
    assert.equal(rotPeriod(gen().map(pnormN)), per, `${name}: 회전 주기`);
});
ok("rotPeriod가 π 주기 도형도 짚어낸다", () => {
  // 5-cell ∪ (−5-cell)은 중심대칭이라 π에서 되돌아오지만, 5-cell이 π/2로 안 돌아오므로 π/2도 아니다.
  // rotPeriod의 π 분기가 실제로 동작하는지 확인한다(정다포체 6종만으로는 이 분기가 안 밟힌다).
  const V = cell5().map(pnormN);
  assert.equal(rotPeriod([...V, ...V.map((v) => v.map((x) => -x))]), Math.PI);
});

// -------------------------------------------------------- 2. 렌더된 레벨별
/** 선분 하나를 방향 무관하게 정규화. 루프 끝에서 정점끼리 자리를 바꿔 방향이 뒤집힐 수 있다. */
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
    [...frame.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)]
      .map((s) => seg(s[1]!, s[2]!, s[3]!, s[4]!)).sort()
  );
}
const frameSets = (svg: string) => { const p = pathFrames(svg); return p.length ? p : lineFrames(svg); };
const dots = (svg: string) => (svg.match(/<circle r="2\.4"/g) ?? []).length;
const render = (c: number) => renderPolytope({ username: "tester", metrics: mk(c) });

console.log("\n레벨별 렌더 (level = round(intel/100 × 5))");
for (const [i, { name, v, e, c }] of SOLIDS.entries()) {
  ok(`L${i} ${name}: 모서리 ${e}개`, () => {
    const svg = render(c);
    const frames = frameSets(svg);
    assert.ok(frames.length > 1, `${name}: 애니메이션 프레임이 있어야 한다`);
    assert.equal(frames[0]!.length, e, `${name}: 렌더된 모서리 수`);
    // 정점 점은 조밀한 상위 두 종에서만 생략한다(찍으면 메시가 뭉갠다).
    assert.equal(dots(svg), v > 60 ? 0 : v, `${name}: 정점 점 수`);
    assert.ok(svg.startsWith("<svg") && svg.trimEnd().endsWith("</svg>"), `${name}: SVG 봉인`);
  });
}
ok("INTELLECT 구간이 README 표와 일치한다", () => {
  // README "다포체" 표의 경계. level = round(intel/100 × 5).
  const BANDS: [number, number, number][] = [    // [시작, 끝, 기대 레벨]
    [0, 9, 0], [10, 29, 1], [30, 49, 2], [50, 69, 3], [70, 89, 4], [90, 100, 5],
  ];
  for (const [lo, hi, lv] of BANDS)
    for (const intel of [lo, hi]) {
      const got = frameSets(render(intel))[0]!.length;
      assert.equal(got, SOLIDS[lv]!.e, `INTELLECT ${intel} → L${lv} ${SOLIDS[lv]!.name} (모서리 ${SOLIDS[lv]!.e})여야 하는데 ${got}`);
    }
});
ok("사다리가 복잡도 순으로 단조 증가한다", () => {
  const counts = SOLIDS.map(({ c }) => frameSets(render(c))[0]!.length);
  for (let i = 1; i < counts.length; i++)
    assert.ok(counts[i]! > counts[i - 1]!, `L${i}(${counts[i]})가 L${i - 1}(${counts[i - 1]})보다 복잡해야 한다`);
});

// ------------------------------------------------------- 3. 루프·레이아웃
console.log("\n회전 루프·레이아웃·무게");
for (const [i, { name, c }] of SOLIDS.entries()) {
  ok(`L${i} ${name}: 루프가 이음새 없이 닫힌다`, () => {
    const frames = frameSets(render(c));
    assert.deepEqual(frames.at(-1), frames[0], `${name}: 마지막 프레임 그림 = 첫 프레임 그림`);
  });
}
for (const [i, { name, c }] of SOLIDS.entries()) {
  ok(`L${i} ${name}: 글리프가 캔버스 안, 데이터 패널(x≥422) 밖`, () => {
    const xs: number[] = [], ys: number[] = [];
    for (const frame of frameSets(render(c)))
      for (const s of frame)
        for (const pt of s.split("|")) {
          const [x, y] = pt.split(",").map(Number);
          xs.push(x!); ys.push(y!);
        }
    assert.ok(Math.min(...xs) > 4 && Math.max(...xs) < 422, `${name}: x ${Math.min(...xs)}~${Math.max(...xs)}`);
    assert.ok(Math.min(...ys) > 4 && Math.max(...ys) < 296, `${name}: y ${Math.min(...ys)}~${Math.max(...ys)}`);
  });
}
ok("글리프 전체가 1바퀴/분 턴테이블에 실려 돈다", () => {
  // 4D 모프와 별개로, 글리프를 감싼 <g>에 60초 1회전 transform이 걸려야 한다.
  for (const { name, c } of SOLIDS) {
    const svg = render(c);
    assert.match(svg, /<animateTransform[^>]*type="rotate"[^>]*dur="60s"[^>]*repeatCount="indefinite"/, `${name}: 턴테이블 회전이 없다`);
    assert.match(svg, /from="0 210 156" to="360 210 156"/, `${name}: 중심(210,156) 기준 0→360° 회전이 아니다`);
  }
});
ok("회전 반경이 캔버스·타이틀·패널을 침범하지 않는다", () => {
  // 턴테이블은 중심에서 가장 먼 점을 반경으로 원을 그린다. 그 원이 다 들어가야 한다.
  // 세로 아래 296, 세로 위는 타이틀(baseline y40)을 피해 41, 가로 오른쪽 패널 422.
  const cx = 210, cy = 156;
  for (const { name, c } of SOLIDS) {
    let R = 0;
    for (const frame of frameSets(render(c)))
      for (const s of frame)
        for (const pt of s.split("|")) {
          const [x, y] = pt.split(",").map(Number);
          R = Math.max(R, Math.hypot(x! - cx, y! - cy));
        }
    assert.ok(cx - R > 4, `${name}: 회전시 왼쪽 ${(cx - R).toFixed(0)} ≤ 4`);
    assert.ok(cx + R < 422, `${name}: 회전시 오른쪽 ${(cx + R).toFixed(0)} ≥ 422(패널)`);
    assert.ok(cy - R > 41, `${name}: 회전시 위 ${(cy - R).toFixed(0)} ≤ 41(타이틀)`);
    assert.ok(cy + R < 296, `${name}: 회전시 아래 ${(cy + R).toFixed(0)} ≥ 296`);
  }
});
ok("어느 티어도 160KB를 넘지 않는다 (README 배지로 쓸 수 있어야 한다)", () => {
  for (const { name, c } of SOLIDS) {
    const kb = Buffer.byteLength(render(c), "utf8") / 1024;
    assert.ok(kb < 160, `${name} 카드가 ${kb.toFixed(1)}KB`);
  }
});
ok("모든 티어가 SMIL 없이도 그려진다 (정적 좌표 폴백)", () => {
  // 애니메이트되는 좌표에 기본값이 없으면 SMIL 미지원 렌더러에서 0으로 접혀 도형이 사라진다.
  for (const { name, c, v } of SOLIDS) {
    const svg = render(c);
    if (v > 60) {
      assert.match(svg, /<path[^>]*\sd="M[^"]+"/, `${name}: path에 기본 d가 없다`);
    } else {
      assert.match(svg, /<line[^>]*\sx1="[-\d.]+"[^>]*\sy1="[-\d.]+"[^>]*\sx2="[-\d.]+"[^>]*\sy2="[-\d.]+"/, `${name}: line에 기본 좌표가 없다`);
      assert.match(svg, /<circle[^>]*\scx="[-\d.]+"[^>]*\scy="[-\d.]+"/, `${name}: circle에 기본 좌표가 없다`);
    }
  }
});
ok("패널의 큰 숫자와 오른쪽 단어가 겹치지 않는다", () => {
  // 세 자리 값(100)에서 숫자와 STRUCTURED류 10글자 단어가 맞붙던 문제. 등폭 폰트라 폭이 계산된다.
  const ADV = 0.6;                                   // Courier 계열 advance ≈ 0.6em
  for (const c of [0, 20, 40, 60, 80, 100]) {
    const svg = render(c);
    const texts = [...svg.matchAll(/<text\s([^>]*)>([^<]*)<\/text>/g)].map((m) => {
      const at = (n: string) => m[1]!.match(new RegExp(`${n}="([^"]*)"`))?.[1];
      const x = +at("x")!, fs = +(at("font-size") ?? 12), ls = +(at("letter-spacing") ?? 0);
      const w = m[2]!.length * (fs * ADV + ls);
      const anchor = at("text-anchor") ?? "start";
      const lo = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
      return { row: Math.round(+at("y")! / 20), lo, hi: lo + w, s: m[2]! };
    }).filter((t) => t.lo >= 400);                   // 패널 영역만 (왼쪽 타이틀 제외)

    for (const t of texts)
      for (const u of texts) {
        if (t === u || t.row !== u.row) continue;    // 같은 줄끼리만 비교
        const overlap = Math.min(t.hi, u.hi) - Math.max(t.lo, u.lo);
        assert.ok(overlap <= 0, `intel=${c}: "${t.s}"와 "${u.s}"가 ${overlap.toFixed(1)}px 겹친다`);
      }
  }
});
ok("능력 축 단어가 도형과 같은 지점에서 바뀐다", () => {
  // 단어는 도형과 같은 level로 골라야 한다. 임계가 따로 놀면 65점은 한 단어, 70점은 다른 도형처럼 어긋난다.
  const wordAt = (c: number) => render(c).match(/font-size="11"[^>]*>([A-Z]+)</g)!.map((s) => s.match(/>([A-Z]+)</)![1]!);
  for (const { name, c } of SOLIDS) {
    const lo = wordAt(c)[0]!;
    // 같은 밴드 안에서는 단어가 안 바뀌고, 밴드를 넘으면 바뀐다.
    const band = SOLIDS.findIndex((s) => s.c === c);
    if (band > 0) assert.notEqual(lo, wordAt(SOLIDS[band - 1]!.c)[0]!, `${name}: 앞 티어와 단어가 같다`);
  }
  // 밴드 경계 양쪽에서 단어가 정확히 갈리는가 (49/50, 69/70)
  assert.equal(wordAt(49)[0], wordAt(30)[0], "30~49는 같은 단어여야 한다");
  assert.notEqual(wordAt(50)[0], wordAt(49)[0], "49→50에서 단어가 바뀌어야 한다");
  assert.equal(wordAt(69)[0], wordAt(50)[0], "50~69는 같은 단어여야 한다");
  assert.notEqual(wordAt(70)[0], wordAt(69)[0], "69→70에서 단어가 바뀌어야 한다");
});
ok("회전 각속도가 티어마다 같고, 정점이 프레임당 최소 0.15px는 움직인다", () => {
  // 각속도가 티어마다 다르면 점수 한 칸 넘을 때 애니메이션 빠르기가 튄다.
  // 그리고 프레임당 이동량이 너무 작으면(예전 0.09px) 안티에일리어싱에 걸려 끊겨 보인다.
  const rates = SOLIDS.map(({ name, c, per }) => {
    const dur = +render(c).match(/<animate [^>]*dur="([\d.]+)s"/)![1]!;   // 모프 dur (턴테이블 60s 아님)
    return { name, deg: (per * (180 / Math.PI)) / dur };   // 초당 회전각
  });
  for (const r of rates)
    assert.ok(Math.abs(r.deg - rates[0]!.deg) < 0.05, `${r.name}: ${r.deg.toFixed(2)}°/s (기준 ${rates[0]!.deg.toFixed(2)}°/s)`);

  // 화면 이동량은 렌더된 키프레임 좌표에서 직접 잰다.
  for (const { name, c } of SOLIDS) {
    const svg = render(c);
    const dur = +svg.match(/<animate [^>]*dur="([\d.]+)s"/)![1]!;   // 모프 dur
    const frames = frameSets(svg);
    let maxStep = 0;
    for (let f = 1; f < frames.length; f++)
      for (let i = 0; i < frames[f]!.length; i++) {
        const pt = (s: string) => s.split("|")[0]!.split(",").map(Number);
        const [x0, y0] = pt(frames[f - 1]![i]!), [x1, y1] = pt(frames[f]![i]!);
        maxStep = Math.max(maxStep, Math.hypot(x1! - x0!, y1! - y0!));
      }
    const perFrame = maxStep / ((dur / (frames.length - 1)) * 60);   // 60fps 기준
    assert.ok(perFrame >= 0.15, `${name}: 프레임당 ${perFrame.toFixed(3)}px — 너무 느려 끊겨 보인다`);
  }
});
ok("키프레임 각도 간격이 티어마다 균일하다", () => {
  // SMIL은 키프레임 사이를 화면좌표로 선형 보간한다. 간격이 벌어지면 구간 중앙에서 반경이
  // 수축해 도형이 펄떡인다(현-호 오차). sweep이 4배인 5-cell은 프레임도 4배여야 한다.
  for (const { name, c, e } of SOLIDS) {
    const per = SOLIDS.find((s) => s.c === c)!.per;
    const N = frameSets(render(c)).length - 1;
    const stepDeg = (per / N) * (180 / Math.PI);
    const limit = e > 900 ? 16 : 12;      // 조밀한 티어만 조금 성기게 허용
    assert.ok(stepDeg <= limit, `${name}: 키프레임 간격 ${stepDeg.toFixed(1)}° (상한 ${limit}°)`);
  }
});

console.log(`\n${checks}개 검사 통과\n`);
for (const [i, { name, gen, e, c }] of SOLIDS.entries()) {
  const kb = (Buffer.byteLength(render(c), "utf8") / 1024).toFixed(1).padStart(6);
  const per = (rotPeriod(gen().map(pnormN)) / Math.PI).toFixed(2);
  console.log(`  L${i}  ${name}  ${String(e).padStart(4)}모서리  ${kb}KB  회전주기 ${per}π`);
}
