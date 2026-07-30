/**
 * 지표 → SVG 카드. 가로형 배지(README 임베드용).
 * 왼쪽 아바타 + 오른쪽 두 수평 게이지(말투 사전 / 구조 신호).
 *
 * 테마 프리셋 + 색 개별 오버라이드 지원(github-readme-stats 방식).
 * GitHub README <img>는 CSS·JS·외부 리소스 차단 → 스타일 전부 인라인 속성.
 * 라벨은 영문이라 폰트 fallback 문제 없음.
 */
import { MIN_SAMPLE, type Metrics } from "./metrics.js";
import { buildFeedback } from "./feedback.js";

export interface Theme {
  bg1: string; bg2: string;
  ink: string; muted: string; track: string;
  karma: string; intel: string;
  ava1: string; ava2: string;
  border: string; title: string;
  glow: boolean;
}

export const THEMES: Record<string, Theme> = {
  black: {
    bg1: "#17161f", bg2: "#0d0c12", ink: "#ececf4", muted: "#8b88a0",
    track: "#2a2836", karma: "#c084fc", intel: "#5eead4",
    ava1: "#3a3350", ava2: "#211d33", border: "#ffffff", title: "#c084fc", glow: false,
  },
  ivory: {
    bg1: "#fdfbf5", bg2: "#f4efe3", ink: "#2e2a24", muted: "#9a9080",
    track: "#e7dfce", karma: "#8b5cf6", intel: "#0d9488",
    ava1: "#efe7d6", ava2: "#e2d7bf", border: "#000000", title: "#8b5cf6", glow: false,
  },
  cyberpunk: {
    bg1: "#1a0b2e", bg2: "#0b0416", ink: "#f2e9ff", muted: "#a06cd5",
    track: "#3a1a5c", karma: "#ff2e97", intel: "#00f0ff",
    ava1: "#3d1163", ava2: "#1c0838", border: "#ff2e97", title: "#00f0ff", glow: true,
  },
  korean: {
    bg1: "#f2e8d2", bg2: "#e6d9ba", ink: "#3a2a1e", muted: "#8a7550",
    track: "#d6c39c", karma: "#c8102e", intel: "#1e5f4f",
    ava1: "#e8d9b6", ava2: "#d4be93", border: "#c8102e", title: "#1e5f4f", glow: false,
  },
};

export interface CardInput {
  username: string;
  metrics: Metrics;
  avatarDataUri?: string | null;
  theme?: string;
  /** 개별 색 오버라이드. 정의된 필드만 프리셋 위에 덮어쓴다. */
  colors?: Partial<Theme>;
  profanityPct?: number | null;
  competencePct?: number | null;
  /** 카드 숫자의 출처. 지표 진위가 검증됐다는 뜻으로 쓰지 않는다. */
  provenance?: "local" | "self-reported" | "unverified";
  /** 로컬에서 실제로 집계한 시각. 제출을 받은 시각과 구분한다. */
  scannedAt?: string | null;
  /** 사람 입력을 골라낸 파서 규칙 버전. */
  filterVersion?: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
const FONT = "'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";

function sourceLabel(provenance: CardInput["provenance"]): string {
  if (provenance === "local") return "LOCAL SCAN";
  if (provenance === "self-reported") return "SELF-REPORTED";
  return "UNVERIFIED URL DATA";
}

function cardMetadata(input: CardInput): string {
  const metricVersion = input.metrics.metricVersion ?? 1;
  const filterVersion = input.filterVersion ?? 1;
  const scannedDate = input.scannedAt && Number.isFinite(Date.parse(input.scannedAt))
    ? new Date(input.scannedAt).toISOString().slice(0, 10)
    : null;
  const scanned = scannedDate ? ` · SCANNED ${scannedDate}` : "";
  return `N=${Math.max(0, Math.floor(input.metrics.prompts)).toLocaleString("en-US")} · RULES F${filterVersion}/M${metricVersion} · ${sourceLabel(input.provenance)}${scanned}`;
}

function renderCollectingCard(input: CardInput, width: number, height: number): string {
  const { username, metrics: m } = input;
  const base = THEMES[input.theme ?? "black"] ?? THEMES.black;
  const overrides = Object.fromEntries(
    Object.entries(input.colors ?? {}).filter(([, v]) => v != null && v !== "")
  );
  const C: Theme = { ...base, ...overrides } as Theme;
  const sample = Math.max(0, Math.floor(m.prompts));
  const center = width / 2;
  const progressY = height / 2 + 4;
  const footerSize = width < 600 ? 9 : 11;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} prompt habits collecting">
  <defs>
    <linearGradient id="cbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg1}"/>
      <stop offset="1" stop-color="${C.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="14" fill="url(#cbg)"/>
  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="13" fill="none" stroke="${C.border}" stroke-opacity="0.12"/>
  <text x="24" y="34" font-family="${FONT}" font-size="16" font-weight="800" fill="${C.title}">PROMPT HABITS</text>
  <text x="${width - 24}" y="34" font-family="${FONT}" font-size="13" text-anchor="end" fill="${C.muted}">@${esc(username)}</text>
  <text x="${center}" y="${progressY}" font-family="${FONT}" font-size="25" font-weight="800" text-anchor="middle" fill="${C.ink}">COLLECTING ${sample}/${MIN_SAMPLE}</text>
  <text x="${center}" y="${progressY + 27}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="${C.muted}">THE SUMMARY UNLOCKS AT ${MIN_SAMPLE} PROMPTS</text>
  <text x="24" y="${height - 16}" font-family="${FONT}" font-size="${footerSize}" fill="${C.muted}">${esc(cardMetadata(input))}</text>
</svg>`;
}

export function renderCard(input: CardInput): string {
  const { username, metrics: m } = input;
  if (!m.eligible) return renderCollectingCard(input, 500, 200);
  const W = 500, H = 200, R = 16;

  const base = THEMES[input.theme ?? "black"] ?? THEMES.black;
  const overrides = Object.fromEntries(
    Object.entries(input.colors ?? {}).filter(([, v]) => v != null && v !== "")
  );
  const C: Theme = { ...base, ...overrides } as Theme;

  const angel =
    input.profanityPct != null
      ? clamp(100 - input.profanityPct, 0, 100)
      : clamp(100 - m.profanityRate, 0, 100);
  const smart =
    input.competencePct != null ? clamp(input.competencePct, 0, 100) : clamp(m.competence, 0, 100);
  const angelPct = Math.round(angel);
  const smartPct = Math.round(smart);

  const trackX = 168, trackW = 300, knobR = 8;
  const y1 = 96, y2 = 148;
  const karmaKnob = trackX + (trackW * angel) / 100;
  const smartKnob = trackX + (trackW * smart) / 100;

  const glowFilter = C.glow ? ' filter="url(#glow)"' : "";
  const gauge = (y: number, label: string, valueText: string, knobX: number, color: string) => `
    <text x="${trackX}" y="${y - 14}" font-family="${FONT}" font-size="15" font-weight="600" fill="${C.muted}" letter-spacing="0.3">${esc(label)}</text>
    <text x="${trackX + trackW}" y="${y - 14}" font-family="${FONT}" font-size="15" font-weight="700" fill="${C.ink}" text-anchor="end">${esc(valueText)}</text>
    <rect x="${trackX}" y="${y - 3}" width="${trackW}" height="6" rx="3" fill="${C.track}"/>
    <rect x="${trackX}" y="${y - 3}" width="${Math.max(0, knobX - trackX)}" height="6" rx="3" fill="${color}" opacity="0.5"/>
    <circle cx="${knobX}" cy="${y}" r="${knobR}" fill="${color}"${glowFilter}/>
    <circle cx="${knobX}" cy="${y}" r="${knobR}" fill="none" stroke="#000000" stroke-width="1.5" opacity="0.35"/>`;

  const avaCx = 80, avaCy = 100, avaR = 54;
  const avatar = input.avatarDataUri
    ? `<clipPath id="ava"><circle cx="${avaCx}" cy="${avaCy}" r="${avaR}"/></clipPath>
       <image href="${input.avatarDataUri}" x="${avaCx - avaR}" y="${avaCy - avaR}" width="${avaR * 2}" height="${avaR * 2}" clip-path="url(#ava)" preserveAspectRatio="xMidYMid slice"/>
       <circle cx="${avaCx}" cy="${avaCy}" r="${avaR}" fill="none" stroke="${C.border}" stroke-width="2" opacity="0.5"/>`
    : `<circle cx="${avaCx}" cy="${avaCy}" r="${avaR}" fill="url(#avaG)"/>
       <text x="${avaCx}" y="${avaCy + 20}" font-family="${FONT}" font-size="52" font-weight="800" fill="${C.ink}" text-anchor="middle">${esc((username[0] ?? "?").toUpperCase())}</text>`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} prompt habits legacy card">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg1}"/>
      <stop offset="1" stop-color="${C.bg2}"/>
    </linearGradient>
    <linearGradient id="avaG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.ava1}"/>
      <stop offset="1" stop-color="${C.ava2}"/>
    </linearGradient>
    <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" rx="${R}" fill="url(#bg)"/>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="${R - 1}" fill="none" stroke="${C.border}" stroke-opacity="0.12"/>

  ${avatar}

  <text x="${trackX}" y="46" font-family="${FONT}" font-size="19" font-weight="800" fill="${C.title}" letter-spacing="-0.2">prompt habits</text>
  <text x="${trackX + trackW}" y="46" font-family="${FONT}" font-size="15" fill="${C.muted}" text-anchor="end">@${esc(username)}</text>

  ${gauge(y1, "no-swear prompts", `${angelPct}%`, karmaKnob, C.karma)}
  ${gauge(y2, "structure signal", `${smartPct}%`, smartKnob, C.intel)}

  <text x="${trackX}" y="184" font-family="${FONT}" font-size="9.5" fill="${C.muted}">${esc(cardMetadata(input))}</text>
</svg>`;
}

/**
 * 관찰값과 다음 행동을 바로 읽을 수 있는 기본 공유 카드.
 * 기존 다포체 카드는 시각 실험으로 보존하고, 이 카드는 과한 능력 판정을 하지 않는다.
 */
export function renderFeedbackCard(input: CardInput): string {
  const { username, metrics: m } = input;
  const W = 700, H = 260, R = 14;
  const base = THEMES[input.theme ?? "black"] ?? THEMES.black;
  const overrides = Object.fromEntries(
    Object.entries(input.colors ?? {}).filter(([, v]) => v != null && v !== "")
  );
  const C: Theme = { ...base, ...overrides } as Theme;
  const structure = clamp(m.competence, 0, 100);
  const swearPrompts = clamp(m.profanityRate, 0, 100);
  const feedback = buildFeedback(m);
  const sample = Math.max(0, Math.floor(m.prompts));

  const panel = (x: number, label: string, value: string, note: string, color: string) => `
    <rect x="${x}" y="72" width="310" height="82" rx="10" fill="${C.track}" opacity="0.55"/>
    <text x="${x + 18}" y="99" font-family="${FONT}" font-size="12" font-weight="700" letter-spacing="1.4" fill="${C.muted}">${label}</text>
    <text x="${x + 18}" y="137" font-family="${FONT}" font-size="31" font-weight="800" fill="${color}">${value}</text>
    <text x="${x + 292}" y="136" font-family="${FONT}" font-size="11.5" text-anchor="end" fill="${C.muted}">${note}</text>`;

  const body = feedback.status === "collecting"
    ? `
      <rect x="24" y="72" width="652" height="94" rx="10" fill="${C.track}" opacity="0.55"/>
      <text x="350" y="116" font-family="${FONT}" font-size="26" font-weight="800" text-anchor="middle" fill="${C.ink}">COLLECTING ${sample}/${MIN_SAMPLE}</text>
      <text x="350" y="143" font-family="${FONT}" font-size="13" text-anchor="middle" fill="${C.muted}">THE SUMMARY UNLOCKS AT ${MIN_SAMPLE} PROMPTS</text>`
    : panel(24, "STRUCTURE SIGNAL", `${structure.toFixed(1)}%`, "OBSERVED MARKERS", C.intel)
      + panel(366, "SWEAR PROMPTS", `${swearPrompts.toFixed(1)}%`, "LEXICON MATCH", C.karma);

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} prompt habits feedback">
  <defs>
    <linearGradient id="fbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${C.bg1}"/>
      <stop offset="1" stop-color="${C.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="${R}" fill="url(#fbg)"/>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="${R - 1}" fill="none" stroke="${C.border}" stroke-opacity="0.12"/>
  <text x="24" y="34" font-family="${FONT}" font-size="17" font-weight="800" fill="${C.title}" letter-spacing="0.5">PROMPT HABITS</text>
  <text x="676" y="34" font-family="${FONT}" font-size="14" text-anchor="end" fill="${C.muted}">@${esc(username)}</text>
  <text x="24" y="55" font-family="${FONT}" font-size="12.5" fill="${C.muted}">A LOCAL HEURISTIC, NOT AN ABILITY TEST</text>
  ${body}
  <text x="24" y="181" font-family="${FONT}" font-size="11.5" fill="${C.muted}">TRY NEXT</text>
  <rect x="24" y="190" width="652" height="38" rx="8" fill="${C.track}"/>
  <text x="350" y="215" font-family="${FONT}" font-size="14" font-weight="700" text-anchor="middle" fill="${C.ink}" letter-spacing="0.35">${esc(feedback.cardTip)}</text>
  <text x="24" y="248" font-family="${FONT}" font-size="11.5" fill="${C.muted}">${esc(cardMetadata(input))}</text>
</svg>`;
}

// ============================================================================
// PROMPT POLYTOPE — 다면체 와이어프레임. 복잡도=구조 신호, 오라색=말투 참고.
// ============================================================================
const PHI = (1 + Math.sqrt(5)) / 2;
const MONO = "'Courier New','SFMono-Regular',Consolas,monospace";

// ---- 4차원 볼록 정다포체(regular polychora) — 4D에는 정확히 6종뿐이다 ----
// 사다리 전체가 4D다. 점수는 "6종 중 어느 것을 받는가"만 정한다.
// 좌표는 표준 구성이고, 정규성(꼭짓점 차수·모서리 길이 균일)은 polytope.test.ts가 검증한다.

/** 4원소 순열. evenOnly면 짝순열 12개(A4)만. */
function perms4(evenOnly: boolean): number[][] {
  const out: number[][] = [];
  const rec = (rest: number[], acc: number[]): void => {
    if (rest.length === 0) {
      if (!evenOnly) { out.push(acc); return; }
      let inv = 0;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (acc[i]! > acc[j]!) inv++;
      if (inv % 2 === 0) out.push(acc);
      return;
    }
    rest.forEach((_, i) => rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]!]));
  };
  rec([0, 1, 2, 3], []);
  return out;
}
/**
 * base를 좌표 순열 × 부호 조합으로 굴린 궤도(중복 제거). 0인 성분에는 부호를 붙이지 않는다.
 * 정다포체 좌표는 거의 전부 "어떤 기본 벡터의 순열과 부호 전부"라는 형태라 이 하나로 6종을 다 만든다.
 */
function orbit(base: number[], evenOnly = false): number[][] {
  const nz: number[] = [];
  base.forEach((v, i) => { if (v !== 0) nz.push(i); });
  const seen = new Set<string>(), out: number[][] = [];
  for (const p of perms4(evenOnly))
    for (let m = 0; m < 1 << nz.length; m++) {
      const s = base.slice();
      nz.forEach((i, b) => { if (m & (1 << b)) s[i] = -s[i]!; });
      const v = [s[p[0]!]!, s[p[1]!]!, s[p[2]!]!, s[p[3]!]!];
      const key = v.map((n) => (Math.round(n * 1e9) / 1e9 || 0).toFixed(9)).join(",");
      if (!seen.has(key)) { seen.add(key); out.push(v); }
    }
  return out;
}

/** 5-cell {3,3,3}: 5정점·10모서리. 가장 단순한 4D 정다포체(정사면체의 4D판). */
export function cell5(): number[][] {
  // R^5의 표준기저 5개는 "합=0" 초평면(=4차원) 위에서 정5포체를 이룬다.
  // 그 초평면의 정규직교기저(헬머트)로 4D 좌표를 뽑는다.
  const B: number[][] = [];
  for (let j = 1; j <= 4; j++) {
    const n = 1 / Math.sqrt(j * (j + 1));
    const row = new Array<number>(5).fill(0);
    for (let k = 0; k < j; k++) row[k] = n;
    row[j] = -j * n;
    B.push(row);
  }
  return Array.from({ length: 5 }, (_, i) => B.map((r) => r[i]!));
}
/** 16-cell {3,3,4}: 8정점·24모서리. 정팔면체의 4D판. */
export function cell16(): number[][] { return orbit([1, 0, 0, 0]); }
/** 8-cell(tesseract) {4,3,3}: 16정점·32모서리. 정육면체의 4D판 — '큐브 안의 큐브'. */
export function cell8(): number[][] { return orbit([1, 1, 1, 1]); }
/** 24-cell {3,4,3}: 24정점·96모서리. 3D에 대응물이 없는 4D 고유 도형(자기쌍대). */
export function cell24(): number[][] { return orbit([1, 1, 0, 0]); }
/** 600-cell {3,3,5}: 120정점·720모서리. 단위 사원수(이진 정이십면체군) 그 자체. */
export function cell600(): number[][] {
  return [
    ...orbit([1, 0, 0, 0]),                            // 8
    ...orbit([0.5, 0.5, 0.5, 0.5]),                    // 16
    ...orbit([PHI / 2, 0.5, 1 / (2 * PHI), 0], true),  // 96 (짝순열)
  ];
}
/** 120-cell {5,3,3}: 600정점·1200모서리. 4D 정다포체 중 가장 복잡하다. */
export function cell120(): number[][] {
  const p = PHI, pi = 1 / PHI, pi2 = pi * pi, p2 = p * p, r5 = Math.sqrt(5);
  return [
    ...orbit([0, 0, 2, 2]),            // 24
    ...orbit([1, 1, 1, r5]),           // 64
    ...orbit([pi2, p, p, p]),          // 64
    ...orbit([pi, pi, pi, p2]),        // 64
    ...orbit([0, pi2, 1, p2], true),   // 96
    ...orbit([0, pi, p, r5], true),    // 96
    ...orbit([pi, 1, p, 2], true),     // 192
  ];
}

/** 정사면체 {3,3}: 4정점·6모서리. 3D. 바닥 티어 — "아직 4D로 못 올라옴"의 문턱, 회전만(모프 없음). */
export function cell3(): number[][] { return [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]; }

/**
 * 점수 낮음 → 단순, 높음 → 복잡. 3D 정사면체(바닥) + 4D 정다포체 6종 = 7단계.
 * 생성자를 담는다 — 이 모듈은 게이지 카드(renderCard)와 CLI도 import하므로,
 * 미리 굽지 않아야 다포체를 안 쓰는 경로가 120-cell 생성 비용을 물지 않는다.
 */
const POLY_LEVELS: (() => number[][])[] = [cell3, cell5, cell16, cell8, cell24, cell600, cell120];
/**
 * 구조 신호 → 도형 경계(7단계이므로 컷 6개). 균등 분할이 아니라 가운데를 촘촘히 둔 완만한 종 모양 —
 * 점수가 가운데 몰리는 사람들을 여러 티어로 퍼뜨린다. 상대평가(퍼센타일)가 아니라 절대평가라
 * 남이 submit해도 내 티어는 안 바뀌고 CLI가 로컬에서 티어를 바로 낸다.
 * 잠정값: 현재 표본 2건뿐이라 감으로 잡았다. 데이터가 쌓이면 실제 분포의 분위수로 재조정하고 버전을 올린다.
 */
const STRUCTURE_CUTS = [18, 34, 46, 56, 68, 84];
/** 도형 번호. 구조 신호와 **같은 level**로 고르므로 문구와 도형이 어긋날 수 없다. */
const LEVEL_WORDS = ["SHAPE 1", "SHAPE 2", "SHAPE 3", "SHAPE 4", "SHAPE 5", "SHAPE 6", "SHAPE 7"];
// 세 상수의 길이는 묶여 있다: level은 0..STRUCTURE_CUTS.length라 도형·라벨 배열이 그만큼 있어야 한다.
// 컷 재조정 시 한쪽만 늘리면 POLY_LEVELS[level]이 undefined가 되므로 로드 시점에 막는다.
if (POLY_LEVELS.length !== STRUCTURE_CUTS.length + 1 || POLY_LEVELS.length !== LEVEL_WORDS.length)
  throw new Error("POLY_LEVELS·STRUCTURE_CUTS·LEVEL_WORDS 길이 불일치 (티어 = 컷 + 1)");

export function pnormN(v: number[]): number[] { const m = Math.hypot(...v) || 1; return v.map((x) => x / m); }
export function pdistN(a: number[], b: number[]): number { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i]! - b[i]!; s += d * d; } return Math.sqrt(s); }
/** 최소거리 모서리: 정다포체는 "가장 짧은 정점쌍"이 곧 모서리다. */
export function polyEdges(V: number[][]): [number, number][] {
  let min = Infinity;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) min = Math.min(min, pdistN(V[i]!, V[j]!));
  const E: [number, number][] = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (pdistN(V[i]!, V[j]!) <= min * 1.12) E.push([i, j]);
  return E;
}
/**
 * 등각회전이 도형을 자기 자신으로 되돌리는 최소 각. 정점끼리 자리를 바꿀 뿐 그림은 픽셀 동일하므로,
 * 이 각만 굽으면 루프가 이음새 없이 닫히고 프레임 중복이 사라진다(도형마다 다르므로 실측한다).
 */
export function rotPeriod(V: number[][]): number {
  const key = (W: number[][]) =>
    W.map((v) => v.map((n) => (Math.round(n * 1e6) / 1e6 || 0).toFixed(6)).join(",")).sort().join("|");
  const base = key(V);
  for (const th of [Math.PI / 2, Math.PI]) if (key(V.map((v) => rot4(v, th))) === base) return th;
  return 2 * Math.PI;
}
/** 레벨별 기하는 입력과 무관한 상수다. 처음 쓰일 때 한 번만 굽는다(120-cell은 O(600²)). */
const GEOM = new Map<number, { V: number[][]; E: [number, number][]; sweep: number; is4: boolean }>();
function geometry(level: number) {
  let g = GEOM.get(level);
  if (!g) {
    const V = POLY_LEVELS[level]!().map(pnormN);
    const is4 = V[0]!.length === 4;            // 정점 성분 수가 곧 차원(사면체는 3, 정다포체는 4)
    g = { V, E: polyEdges(V), sweep: is4 ? rotPeriod(V) : 2 * Math.PI, is4 };
    GEOM.set(level, g);
  }
  return g;
}
// 3D Y축 스핀 — 4D가 아닌 바닥 티어(사면체)용. 한 바퀴 = 2π. 모프 없이 그냥 돈다.
function spin3(v: number[], th: number): number[] {
  const x = v[0]!, y = v[1]!, z = v[2]!;
  return [x * Math.cos(th) - z * Math.sin(th), y, x * Math.sin(th) + z * Math.cos(th)];
}
// 4D 등각회전(isoclinic): XW·YZ 평면을 같은 각으로 회전 → 2π에 매끈히 닫힌다.
// w가 변하면 아래 원근투영에서 안팎이 뒤집혀 4D 특유의 '접혀 도는' 모션이 나온다.
function rot4(v: number[], th: number): number[] {
  const c = Math.cos(th), s = Math.sin(th);
  const x = v[0]!, y = v[1]!, z = v[2]!, w = v[3]!;
  return [x * c - w * s, y * c - z * s, y * s + z * c, x * s + w * c];
}
// 4D→3D 원근투영: w가 시점에 가까울수록 크게 보인다(테서랙트 '안팎 반전' 효과).
function proj4to3(v: number[], D: number): number[] {
  const g = D / (D - v[3]!);
  return [v[0]! * g, v[1]! * g, v[2]! * g];
}
// 3D→2D 고정 기울기 원근투영. 회전은 rot4가 이미 걸어 놓은 상태로 들어온다.
function tiltProject(v: number[], cx: number, cy: number, s: number) {
  const ax = 0.42;
  const x = v[0]!, y = v[1]!, z = v[2]!;
  const y1 = y * Math.cos(ax) - z * Math.sin(ax);
  const z2 = y * Math.sin(ax) + z * Math.cos(ax);
  const f = 5 / (5 - z2);
  return { x: cx + x * s * f, y: cy - y1 * s * f, z: z2 };
}
// OKLCH(지각 균등 색공간) → 선형 sRGB. 색역 판정과 hex 변환에 재사용.
function oklchLin(L: number, C: number, H: number): number[] {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
// OKLCH → sRGB hex. 색역을 벗어나면 채널을 클립하는 대신 L·H를 두고 채도만 줄여 맞춘다.
// 클립하면 명도가 틀어져 "등명도 발산 팔레트"가 깨지므로(적 팔이 청록 팔보다 어두워짐), 감마 매핑한다.
function oklch(L: number, C: number, H: number): string {
  const inGamut = (c: number) => oklchLin(L, c, H).every((u) => u >= -1e-6 && u <= 1 + 1e-6);
  let c = C;
  if (!inGamut(C)) { let lo = 0, hi = C; for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (inGamut(mid)) lo = mid; else hi = mid; } c = lo; }
  return "#" + oklchLin(L, c, H).map((u) => {
    const g = Math.max(0, Math.min(1, u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055));
    return Math.round(g * 255).toString(16).padStart(2, "0");
  }).join("");
}
// 말투 참고 색: 발산 그라디언트. k=0 욕설 사전 일치 많음 ↔ 0.5 중립 ↔ 1 일치 없음.
// 채도만 가운데서 0으로 죽이고 색상은 양끝 고정(무지개로 쓸지 않기) — 이게 발산 팔레트의 핵심.
function karmaColors(k: number, glow: boolean): { line: string; vert: string; core: string; coreOn: boolean } {
  const t = (clamp(k, 0, 1) - 0.5) * 2;          // -1(caustic) .. +1(affirming)
  const hue = t < 0 ? 25 : 200;                  // 따뜻한 적 / 차가운 청록
  const c = Math.abs(t);                          // 가운데 0 .. 양끝 1
  return {
    line: oklch(0.78, 0.02 + 0.15 * c, hue),      // 어두운 배경에서 읽히게 밝게
    vert: oklch(0.9, 0.02 + 0.11 * c, hue),
    core: oklch(0.84, 0.05 + 0.15 * c, hue),
    coreOn: glow,                                 // 칭찬>욕이면 발광 펄스(레어 보상)
  };
}

export function renderPolytope(input: CardInput): string {
  const { username, metrics: m } = input;
  if (!m.eligible) return renderCollectingCard(input, 700, 300);
  const W = 700, H = 300;
  // renderCard와 같은 방어. 다포체가 이제 기본 카드라 입력이 어긋나도 레벨 인덱스를 벗어나면 안 된다
  // (NaN이면 Math.round도 NaN이고, clamp 두 겹으로도 NaN은 안 걸러진다 → POLY_LEVELS[NaN]).
  const intel = clamp(Math.round(m.competence) || 0, 0, 100);
  const glow = m.karma === "cyan";      // 칭찬>욕이면 발광(발산 색과 별개 축이라 붉은 카드도 발광할 수 있다)
  const angel = Math.round(Math.max(0, Math.min(100, 100 - m.profanityRate)));

  const level = STRUCTURE_CUTS.reduce((n, c) => n + (intel >= c ? 1 : 0), 0);   // 0..6 (7티어)
  const { V, E, sweep, is4 } = geometry(level);
  const heavy = V.length > 60;          // 600·120-cell: 선분 개별 애니메이트하면 ~1MB → 단일 path 모프
  const cx = 210, cy = 156, scale = 100;
  // 등각회전은 |w|가 클수록 (x,y,z)가 작아져 원근 확대와 상쇄된다 → 3D 시절과 같은 배율로 크기가 맞는다.
  const D4 = 2.6;                        // 4D→3D 원근 거리(안팎 반전 강도)
  // 말투 색은 no-swear 값에 연동해 숫자와 색이 일치한다. 칭찬>욕이면 발광 코어.
  const col = karmaColors(angel / 100, glow);

  // 회전을 프레임별 좌표로 구워 SMIL로 재생(정적 SVG는 4D 회전을 못 한다).
  // XW·YZ 등각회전 → w 원근투영 → 기울기 투영. sweep은 도형이 자기 자신으로 되돌아오는 각(rotPeriod).
  //
  // 프레임 수는 sweep에 비례해야 한다. SMIL은 키프레임 사이를 '화면좌표' 선형 보간하므로
  // 키프레임 간격이 벌어질수록 구간 중앙에서 반경이 수축한다(현-호 오차 = 1-cos(간격/2)).
  // 간격을 도형마다 같게 잡아야 왜곡이 균일하다 — sweep이 2π인 5-cell만 N을 4배로 준다.
  // 회전 각속도를 티어마다 같게 잡는다. sweep이 4배인 5-cell은 한 바퀴에 4배 걸릴 뿐 체감 속도는 같다.
  // 45초/한 바퀴였을 때는 정점이 초당 5.7px = 프레임당 0.09px밖에 안 움직였다. 한 픽셀을 지나는 데
  // 11프레임이 걸리니 안티에일리어싱이 중간을 못 그려내고 몇 프레임마다 한 칸씩 튀는 것처럼 보였다.
  const RATE = Math.PI / 30;                    // 초당 회전각 6° → 정점 이동 ≈ 0.28px/프레임
  const DUR = +(sweep / RATE).toFixed(1);
  // 키프레임 간격. SMIL은 키프레임 사이를 화면좌표로 선형 보간하므로 참 궤적에서 벗어나는 양이
  // 간격²에 비례한다(11.25°에서 0.93px, 5.6°에서 0.24px). 모서리가 많은 티어는 프레임당 용량이
  // 커서 간격을 넓히고 그만큼 오차를 감수한다.
  const STEP = E.length > 900 ? Math.PI / 12 : E.length > 200 ? Math.PI / 16 : Math.PI / 32;
  const N = Math.max(4, Math.round(sweep / STEP)), baseAngle = 0.62;
  const frames = Array.from({ length: N + 1 }, (_, f) => {
    const th = baseAngle + (sweep * f) / N;
    return V.map((v) => tiltProject(is4 ? proj4to3(rot4(v, th), D4) : spin3(v, th), cx, cy, scale));
  });
  const A = `dur="${DUR}s" repeatCount="indefinite"`;
  // 애니메이트되는 속성은 전부 정적 기본값을 함께 박는다. SMIL 미지원 렌더러(resvg·일부
  // 마크다운 프리뷰·OG 이미지 생성기)에서 기본값이 없으면 좌표가 0으로 접혀 도형이 사라진다.
  const f0 = frames[0]!;

  let edges: string, verts: string;
  if (heavy) {
    // 모서리 전체를 하나의 <path>로 그리고 d를 프레임마다 모프(애니메이트 태그 1개로 끝낸다).
    const dOf = (fr: { x: number; y: number }[]) =>
      E.map(([a, b]) => `M${fr[a]!.x.toFixed(0)} ${fr[a]!.y.toFixed(0)}L${fr[b]!.x.toFixed(0)} ${fr[b]!.y.toFixed(0)}`).join("");
    edges = `<path fill="none" stroke="${col.line}" stroke-width="1" stroke-opacity="0.55" d="${dOf(f0)}"><animate attributeName="d" ${A} values="${frames.map(dOf).join(";")}"/></path>`;
    verts = "";                          // 조밀 메시라 정점 점은 생략(찍으면 뭉갠다)
  } else {
    const px = (i: number) => frames.map((fr) => fr[i]!.x.toFixed(1));
    const py = (i: number) => frames.map((fr) => fr[i]!.y.toFixed(1));
    const opV = (i: number) => frames.map((fr) => (0.4 + 0.6 * ((fr[i]!.z + 1.4) / 2.8)).toFixed(2));
    const opE = (a: number, b: number) => frames.map((fr) => (0.2 + 0.55 * (((fr[a]!.z + fr[b]!.z) / 2 + 1.4) / 2.8)).toFixed(2));
    edges = E.map(([a, b]) => `<line stroke="${col.line}" stroke-width="1.1" x1="${f0[a]!.x.toFixed(1)}" y1="${f0[a]!.y.toFixed(1)}" x2="${f0[b]!.x.toFixed(1)}" y2="${f0[b]!.y.toFixed(1)}" stroke-opacity="${opE(a, b)[0]}">
    <animate attributeName="x1" ${A} values="${px(a).join(";")}"/><animate attributeName="y1" ${A} values="${py(a).join(";")}"/>
    <animate attributeName="x2" ${A} values="${px(b).join(";")}"/><animate attributeName="y2" ${A} values="${py(b).join(";")}"/>
    <animate attributeName="stroke-opacity" ${A} values="${opE(a, b).join(";")}"/></line>`).join("");
    verts = V.map((_, i) => `<circle r="2.4" fill="${col.vert}" filter="url(#pvg)" cx="${f0[i]!.x.toFixed(1)}" cy="${f0[i]!.y.toFixed(1)}" fill-opacity="${opV(i)[0]}">
    <animate attributeName="cx" ${A} values="${px(i).join(";")}"/><animate attributeName="cy" ${A} values="${py(i).join(";")}"/>
    <animate attributeName="fill-opacity" ${A} values="${opV(i).join(";")}"/></circle>`).join("");
  }
  // 중앙 코어: 또렷한 심(블러 없음) + 은은한 후광(블러) 2겹. 과거의 단일 블러 별은 흐릿한 얼룩이었다.
  // 턴테이블에 실려 제자리에서 돈다. 칭찬>욕이면(색과 무관) 후광이 발광 펄스.
  const starPath = (r: number) => {
    const s = r / 12;
    const pts = [[0, -12], [2.2, -2.2], [12, 0], [2.2, 2.2], [0, 12], [-2.2, 2.2], [-12, 0], [-2.2, -2.2]]
      .map(([x, y]) => `${(x! * s).toFixed(1)},${(y! * s).toFixed(1)}`);
    return `M${pts.join(" L")} Z`;
  };
  const haloOp = col.coreOn ? 0.42 : 0.22;
  const haloPulse = col.coreOn
    ? `<animate attributeName="opacity" dur="3.5s" repeatCount="indefinite" values="${haloOp};${(haloOp + 0.3).toFixed(2)};${haloOp}"/>`
    : "";
  const core = `<g transform="translate(${cx},${cy})">` +
    `<path d="${starPath(11)}" fill="${col.core}" opacity="${haloOp}" filter="url(#pcg)">${haloPulse}</path>` +
    `<path d="${starPath(5)}" fill="${col.core}" opacity="${col.coreOn ? 1 : 0.92}"/></g>`;

  const plus = (x: number, y: number) => `<path d="M${x - 6},${y} h12 M${x},${y - 6} v12" stroke="#5a5a66" stroke-width="1" opacity="0.45"/>`;
  const corners = [plus(40, 44), plus(W - 40, 44), plus(40, H - 40), plus(W - 40, H - 40)].join("");

  const iWord = LEVEL_WORDS[level]!;
  const kWord = "LEXICON";
  // 데이터 패널: 라벨(왼) · 큰 숫자 · 단어(오른). 겹치지 않게 폭·간격 확보.
  const panel = (y: number, label: string, val: string, word: string) => {
    const x = 422, w = 262, h = 58;
    const br = (px: number, py: number, dx: number, dy: number) => `<path d="M${px + dx},${py} h${-dx} v${dy}" stroke="#6a6a78" stroke-width="1.3" fill="none" opacity="0.7"/>`;
    return `${br(x, y, 13, 13)}${br(x + w, y, -13, 13)}${br(x, y + h, 13, -13)}${br(x + w, y + h, -13, -13)}
      <text x="${x + 20}" y="${y + 35}" font-family="${MONO}" font-size="12.5" letter-spacing="1.5" fill="#9a9aa8">${label}</text>
      <!-- 큰 숫자는 x+140 중앙정렬. 오른쪽 단어(최대 10글자 × 7.6px = 76px, 끝이 x+w-16)의
           왼쪽 끝이 592라, 세 자리 값("100" = 43.2px)을 x+150에 두면 1.6px 겹친다. -->
      <text x="${x + 140}" y="${y + 39}" font-family="${MONO}" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${val}</text>
      <text x="${x + w - 16}" y="${y + 35}" font-family="${MONO}" font-size="11" letter-spacing="1" fill="#8a8a98" text-anchor="end">${word}</text>`;
  };

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} prompt habits polytope experiment">
  <defs>
    <radialGradient id="pbg" cx="40%" cy="45%" r="78%"><stop offset="0" stop-color="#141419"/><stop offset="1" stop-color="#08080b"/></radialGradient>
    <filter id="pvg" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="pcg" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="2.4"/></filter>
    <pattern id="pgrid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0 H0 V26" fill="none" stroke="#ffffff" stroke-opacity="0.03"/></pattern>
  </defs>
  <rect width="${W}" height="${H}" rx="14" fill="url(#pbg)"/>
  <rect width="${W}" height="${H}" rx="14" fill="url(#pgrid)"/>
  <rect x="0.6" y="0.6" width="${W - 1.2}" height="${H - 1.2}" rx="13" fill="none" stroke="#ffffff" stroke-opacity="0.08"/>
  ${corners}
  <text x="40" y="40" font-family="${MONO}" font-size="14" letter-spacing="2.5" fill="#b8b8c4">${esc(username.toUpperCase())} / POLYTOPE EXPERIMENT</text>
  <!-- 4D 모프(위에서 구운 프레임)는 그대로 두고, 글리프 전체를 중심 기준 1바퀴/분(60초)으로
       천천히 돌린다. 베이크 좌표가 아니라 transform 회전이라 각도 보간으로 매끄럽고 용량도 0. -->
  <g><animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="60s" repeatCount="indefinite"/>${edges}${core}${verts}</g>
  ${panel(116, "STRUCTURE", String(intel).padStart(2, "0"), iWord)}
  ${panel(190, "NO-SWEAR", String(angel).padStart(2, "0"), kWord)}
  <text x="40" y="282" font-family="${MONO}" font-size="10" fill="#777784">${esc(cardMetadata(input))}</text>
</svg>`;
}
