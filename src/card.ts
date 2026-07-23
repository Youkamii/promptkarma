/**
 * 지표 → SVG 카드. 가로형 배지(README 임베드용).
 * 왼쪽 아바타 + 오른쪽 두 수평 게이지(karma / intelligence).
 *
 * 테마 프리셋 + 색 개별 오버라이드 지원(github-readme-stats 방식).
 * GitHub README <img>는 CSS·JS·외부 리소스 차단 → 스타일 전부 인라인 속성.
 * 라벨은 영문이라 폰트 fallback 문제 없음.
 */
import type { Metrics } from "./metrics.js";

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

export function renderCard(input: CardInput): string {
  const { username, metrics: m } = input;
  const W = 500, H = 200, R = 16;

  const base = THEMES[input.theme ?? "black"] ?? THEMES.black;
  const overrides = Object.fromEntries(
    Object.entries(input.colors ?? {}).filter(([, v]) => v != null && v !== "")
  );
  const C: Theme = { ...base, ...overrides } as Theme;

  const angel =
    input.profanityPct != null
      ? clamp(input.profanityPct, 0, 100)
      : clamp(100 - m.profanityRate * 5, 0, 100);
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

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} promptkarma card">
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

  <text x="${trackX}" y="46" font-family="${FONT}" font-size="19" font-weight="800" fill="${C.title}" letter-spacing="-0.2">promptkarma</text>
  <text x="${trackX + trackW}" y="46" font-family="${FONT}" font-size="15" fill="${C.muted}" text-anchor="end">@${esc(username)}</text>

  ${gauge(y1, "karma", `${angelPct}% Angel`, karmaKnob, C.karma)}
  ${gauge(y2, "intelligence", `${smartPct}% smart`, smartKnob, C.intel)}

  <text x="${trackX}" y="184" font-family="${FONT}" font-size="12.5" fill="${C.muted}">${m.prompts.toLocaleString("en-US")} prompts · npx promptkarma</text>
</svg>`;
}

// ============================================================================
// PROMPT POLYTOPE — 다면체 와이어프레임. 복잡도=intelligence, 오라색=karma.
// ============================================================================
const PHI = (1 + Math.sqrt(5)) / 2;
const MONO = "'Courier New','SFMono-Regular',Consolas,monospace";

function circlePts(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [Math.cos(a), Math.sin(a), 0];
  });
}
const POLY_LEVELS: { verts: number[][]; k: number }[] = [
  { verts: circlePts(3), k: 0 },
  { verts: circlePts(4), k: 0 },
  { verts: [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]], k: 1 },
  { verts: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]], k: 1 },
  { verts: [[1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1]], k: 1 },
  { verts: [[0,1,PHI],[0,1,-PHI],[0,-1,PHI],[0,-1,-PHI],[1,PHI,0],[1,-PHI,0],[-1,PHI,0],[-1,-PHI,0],[PHI,0,1],[PHI,0,-1],[-PHI,0,1],[-PHI,0,-1]], k: 1 },
  { verts: fibSphere(24), k: 2 },
  { verts: fibSphere(42), k: 2 },
];
function fibSphere(n: number): number[][] {
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * i) / (n - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = Math.PI * (3 - Math.sqrt(5)) * i;
    pts.push([Math.cos(t) * r, y, Math.sin(t) * r]);
  }
  return pts;
}
function pnorm(v: number[]): number[] { const m = Math.hypot(v[0]!, v[1]!, v[2]!) || 1; return [v[0]! / m, v[1]! / m, v[2]! / m]; }
function pdist(a: number[], b: number[]): number { return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!); }
function polyEdges(V: number[][], k: number): number[][] {
  if (k === 0) return V.map((_, i) => [i, (i + 1) % V.length]);
  let min = Infinity;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) min = Math.min(min, pdist(V[i]!, V[j]!));
  const E: number[][] = [];
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) if (pdist(V[i]!, V[j]!) <= min * 1.12) E.push([i, j]);
  return E;
}
function polyProject(v: number[], cx: number, cy: number, s: number) {
  const ay = 0.62, ax = 0.42;
  const x = v[0]!, y = v[1]!, z = v[2]!;
  const x1 = x * Math.cos(ay) - z * Math.sin(ay);
  const z1 = x * Math.sin(ay) + z * Math.cos(ay);
  const y1 = y * Math.cos(ax) - z1 * Math.sin(ax);
  const z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
  const f = 5 / (5 - z2);
  return { x: cx + x1 * s * f, y: cy - y1 * s * f, z: z2 };
}
const POLY_COLORS: Record<string, { line: string; vert: string; coreOn: boolean; core: string }> = {
  black: { line: "#4a4a52", vert: "#8a8a95", coreOn: false, core: "#ffffff" },
  white: { line: "#d8d8e0", vert: "#ffffff", coreOn: false, core: "#ffffff" },
  cyan: { line: "#cdeeff", vert: "#ffffff", coreOn: true, core: "#bfeeff" },
};

export function renderPolytope(input: CardInput): string {
  const { username, metrics: m } = input;
  const W = 700, H = 300;
  const intel = Math.round(m.competence);
  const karma = m.karma ?? "white";
  const angel = Math.round(Math.max(0, Math.min(100, 100 - m.profanityRate * 5)));

  const level = Math.max(0, Math.min(7, Math.round((intel / 100) * 7)));
  const V = POLY_LEVELS[level]!.verts.map(pnorm);
  const E = polyEdges(V, POLY_LEVELS[level]!.k);
  const cx = 210, cy = 156, scale = 100;
  const P = V.map((v) => polyProject(v, cx, cy, scale));
  const col = POLY_COLORS[karma]!;

  const ez = E.map(([a, b]) => ({ a: a!, b: b!, z: (P[a!]!.z + P[b!]!.z) / 2 })).sort((p, q) => p.z - q.z);
  const edges = ez.map(({ a, b }) => {
    const t = (((P[a]!.z + P[b]!.z) / 2) + 1.4) / 2.8;
    return `<line x1="${P[a]!.x.toFixed(1)}" y1="${P[a]!.y.toFixed(1)}" x2="${P[b]!.x.toFixed(1)}" y2="${P[b]!.y.toFixed(1)}" stroke="${col.line}" stroke-width="${(0.7 + 0.7 * t).toFixed(2)}" stroke-opacity="${(0.28 + 0.6 * t).toFixed(2)}"/>`;
  }).join("");
  const verts = P.map((p) => {
    const t = (p.z + 1.4) / 2.8;
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(1.3 + 1.7 * t).toFixed(2)}" fill="${col.vert}" fill-opacity="${(0.4 + 0.6 * t).toFixed(2)}" filter="url(#pvg)"/>`;
  }).join("");
  const core = `<g transform="translate(${cx},${cy})" opacity="${col.coreOn ? 0.95 : 0.32}"><path d="M0,-12 L2.2,-2.2 L12,0 L2.2,2.2 L0,12 L-2.2,2.2 L-12,0 L-2.2,-2.2 Z" fill="${col.core}" filter="url(#pcg)"/></g>`;

  const plus = (x: number, y: number) => `<path d="M${x - 6},${y} h12 M${x},${y - 6} v12" stroke="#5a5a66" stroke-width="1" opacity="0.45"/>`;
  const corners = [plus(40, 44), plus(W - 40, 44), plus(40, H - 40), plus(W - 40, H - 40)].join("");

  const iWord = intel >= 66 ? "STRUCTURED" : intel >= 33 ? "DELIBERATE" : "SCATTERED";
  const kWord = karma === "cyan" ? "AFFIRMING" : karma === "black" ? "CAUSTIC" : "TEMPERATE";
  // 데이터 패널: 라벨(왼) · 큰 숫자 · 단어(오른). 겹치지 않게 폭·간격 확보.
  const panel = (y: number, label: string, val: string, word: string) => {
    const x = 422, w = 262, h = 58;
    const br = (px: number, py: number, dx: number, dy: number) => `<path d="M${px + dx},${py} h${-dx} v${dy}" stroke="#6a6a78" stroke-width="1.3" fill="none" opacity="0.7"/>`;
    return `${br(x, y, 13, 13)}${br(x + w, y, -13, 13)}${br(x, y + h, 13, -13)}${br(x + w, y + h, -13, -13)}
      <text x="${x + 20}" y="${y + 35}" font-family="${MONO}" font-size="12.5" letter-spacing="1.5" fill="#9a9aa8">${label}</text>
      <text x="${x + 150}" y="${y + 39}" font-family="${MONO}" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${val}</text>
      <text x="${x + w - 16}" y="${y + 35}" font-family="${MONO}" font-size="11" letter-spacing="1" fill="#8a8a98" text-anchor="end">${word}</text>`;
  };

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)} prompt polytope">
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
  <text x="40" y="40" font-family="${MONO}" font-size="14" letter-spacing="2.5" fill="#b8b8c4">${esc(username.toUpperCase())} / PROMPT POLYTOPE</text>
  ${edges}${core}${verts}
  ${panel(116, "INTELLECT", String(intel).padStart(2, "0"), iWord)}
  ${panel(190, "KARMA", String(angel).padStart(2, "0"), kWord)}
</svg>`;
}
