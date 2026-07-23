/**
 * 지표 → SVG 카드. GitHub README는 <img>로 SVG를 띄우고 CSS·JS·외부 리소스를
 * 전부 차단하므로, 스타일은 전부 인라인 속성으로 넣고 폰트는 뷰어 시스템 폰트에
 * fallback한다(웹폰트 임베드 없음). 이 파일의 출력은 그 제약 안에서만 논다.
 */
import type { Metrics } from "./metrics.js";

export interface CardInput {
  username: string;
  metrics: Metrics;
  /** 서버가 채우는 백분위(0~100, 높을수록 상위). 없으면 로컬 절대값으로 임시 표기. */
  profanityPct?: number | null;
  competencePct?: number | null;
}

type Personality = "evil" | "good";

interface Palette {
  bg1: string; bg2: string;
  accent: string; accent2: string;
  tagBg: string; tagText: string;
  crown: string;          // 악마=뿔 / 천사=후광 색
  ink: string; muted: string; faint: string;
  cardBg: string; cardBorder: string;
}

const PALETTES: Record<Personality, Palette> = {
  evil: {
    bg1: "#fff6f1", bg2: "#ffe9e0", accent: "#f2704e", accent2: "#ff8b6b",
    tagBg: "#ffd9cc", tagText: "#d95f3e", crown: "#6b4b45",
    ink: "#2e1f1d", muted: "#a9756a", faint: "#c2a59d",
    cardBg: "#fffaf7", cardBorder: "#ffd9cc",
  },
  good: {
    bg1: "#f0fbff", bg2: "#dff4ff", accent: "#2f9bd4", accent2: "#66c3ea",
    tagBg: "#cceefb", tagText: "#1f7fb0", crown: "#f4c95d",
    ink: "#12303d", muted: "#5a8aa0", faint: "#9db9c6",
    cardBg: "#f7fcff", cardBorder: "#cceefb",
  },
};

interface Verdict {
  personality: Personality;
  capable: boolean;
  title: string;
  sub: string;
  tags: [string, string];
}

/**
 * 4분면 판정. 백분위가 있으면 그걸로, 없으면 로컬 절대 임계값으로.
 * 임계값은 서버 백분위가 붙기 전까지의 임시값이다(측정된 개인 분포 기준).
 */
function classify(m: Metrics, profanityPct?: number | null, competencePct?: number | null): Verdict {
  const evil = profanityPct != null ? profanityPct >= 50 : m.profanityRate >= 5;
  const capable = competencePct != null ? competencePct >= 50 : m.competence >= 40;
  const personality: Personality = evil ? "evil" : "good";

  if (evil && capable)
    return { personality, capable, title: "유능한 폭군", sub: "험하게 굴지만, 시킬 줄은 안다", tags: ["거친 입", "치밀한 지시"] };
  if (evil && !capable)
    return { personality, capable, title: "성마른 진상", sub: "화는 많고, 설명은 적다", tags: ["거친 입", "막연한 지시"] };
  if (!evil && capable)
    return { personality, capable, title: "온화한 장인", sub: "말도 지시도 빈틈없다", tags: ["고운 말", "치밀한 지시"] };
  return { personality, capable, title: "착한 방목자", sub: "친절하지만 다 맡긴다", tags: ["고운 말", "막연한 지시"] };
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

const FONT = "'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',system-ui,-apple-system,sans-serif";

/** 악마 뿔 또는 천사 후광. 캐릭터 그룹 기준 좌표(얼굴 중심 150,168). */
function crown(p: Personality, pal: Palette): string {
  if (p === "evil") {
    return `
      <path d="M96,74 C80,52 78,30 88,16 C102,34 108,54 112,72 Z" fill="${pal.crown}"/>
      <path d="M204,74 C220,52 222,30 212,16 C198,34 192,54 188,72 Z" fill="${pal.crown}"/>`;
  }
  // 후광: 얼굴 위 얇은 타원 링
  return `<ellipse cx="150" cy="52" rx="66" ry="16" fill="none" stroke="${pal.crown}" stroke-width="9"/>`;
}

/** 표정. 악마=내리깐 눈+한쪽 올린 스머크, 천사=반달 웃는눈+부드러운 미소. */
function face(p: Personality, pal: Palette): string {
  const blush = `
    <circle cx="106" cy="192" r="18" fill="${pal.accent2}" opacity="0.45"/>
    <circle cx="194" cy="192" r="18" fill="${pal.accent2}" opacity="0.45"/>`;
  if (p === "evil") {
    return `${blush}
      <path d="M116,150 L146,158" stroke="#4a2f2a" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M154,158 L184,150" stroke="#4a2f2a" stroke-width="9" stroke-linecap="round" fill="none"/>
      <path d="M120,196 Q150,222 186,198" stroke="#4a2f2a" stroke-width="9" stroke-linecap="round" fill="none"/>`;
  }
  return `${blush}
    <path d="M118,158 q14,-16 28,0" stroke="#2a3f4a" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M154,158 q14,-16 28,0" stroke="#2a3f4a" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M122,194 q28,26 56,0" stroke="#2a3f4a" stroke-width="9" stroke-linecap="round" fill="none"/>`;
}

/** 능력 신호: 유능하면 캐릭터 옆에 작은 별 세 개(절제된 반짝임). */
function sparkles(pal: Palette): string {
  const star = (x: number, y: number, s: number) =>
    `<path transform="translate(${x},${y}) scale(${s})" d="M0,-10 L2.6,-2.6 L10,0 L2.6,2.6 L0,10 L-2.6,2.6 L-10,0 L-2.6,-2.6 Z" fill="${pal.accent}"/>`;
  return `${star(70, 120, 1.1)}${star(232, 96, 0.8)}${star(238, 176, 0.6)}`;
}

export function renderCard(input: CardInput): string {
  const { username, metrics: m } = input;
  const v = classify(m, input.profanityPct, input.competencePct);
  const pal = PALETTES[v.personality];

  const W = 480, H = 600, CX = W / 2;

  // 지표 note (백분위 있으면 병기)
  const swearNote =
    m.promptsPerSwear === null ? "욕설 없음"
    : `약 ${Math.round(m.promptsPerSwear)}번에 한 번` +
      (input.profanityPct != null ? ` · 상위 ${Math.round(100 - input.profanityPct)}%` : "");
  const compNote =
    input.competencePct != null ? `상위 ${Math.round(100 - input.competencePct)}%` : "지시의 구조화 정도";

  // 태그 칩 (가변 폭)
  const chip = (text: string, cx: number, y: number) => {
    const w = text.length * 15 + 44;
    return `
      <rect x="${cx - w / 2}" y="${y}" width="${w}" height="42" rx="21" fill="${pal.tagBg}"/>
      <text x="${cx}" y="${y + 28}" font-family="${FONT}" font-size="20" font-weight="600" fill="${pal.tagText}" text-anchor="middle">${esc(text)}</text>`;
  };
  const gap = 16;
  const w0 = v.tags[0].length * 15 + 44;
  const w1 = v.tags[1].length * 15 + 44;
  const tagsTotal = w0 + w1 + gap;
  const tag0cx = CX - tagsTotal / 2 + w0 / 2;
  const tag1cx = CX - tagsTotal / 2 + w0 + gap + w1 / 2;

  // 지표 카드
  const statCard = (x: number, label: string, value: string, note: string) => {
    const cw = 196, cx = x + cw / 2;
    return `
      <rect x="${x}" y="452" width="${cw}" height="112" rx="24" fill="${pal.cardBg}" stroke="${pal.cardBorder}" stroke-width="1.5"/>
      <text x="${cx}" y="486" font-family="${FONT}" font-size="19" font-weight="600" fill="${pal.muted}" text-anchor="middle">${esc(label)}</text>
      <text x="${cx}" y="528" font-family="${FONT}" font-size="46" font-weight="800" fill="${pal.accent}" text-anchor="middle">${esc(value)}</text>
      <text x="${cx}" y="552" font-family="${FONT}" font-size="15" fill="${pal.muted}" text-anchor="middle">${esc(note)}</text>`;
  };

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(username)}: ${esc(v.title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.bg1}"/>
      <stop offset="1" stop-color="${pal.bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="28" fill="url(#bg)"/>

  <text x="40" y="58" font-family="${FONT}" font-size="24" font-weight="800" fill="${pal.accent}">promptkarma</text>
  <text x="${W - 40}" y="58" font-family="${FONT}" font-size="19" fill="${pal.faint}" text-anchor="end">@${esc(username)}</text>

  ${chip(v.tags[0], tag0cx, 90)}
  ${chip(v.tags[1], tag1cx, 90)}

  <g transform="translate(90,150) scale(0.7)">
    <ellipse cx="150" cy="270" rx="96" ry="22" fill="${pal.accent}" opacity="0.12"/>
    ${crown(v.personality, pal)}
    <circle cx="150" cy="168" r="96" fill="${pal.accent2}"/>
    ${face(v.personality, pal)}
  </g>
  ${v.capable ? sparkles(pal) : ""}

  <text x="${CX}" y="392" font-family="${FONT}" font-size="52" font-weight="900" fill="${pal.ink}" text-anchor="middle" letter-spacing="-1">${esc(v.title)}</text>
  <text x="${CX}" y="426" font-family="${FONT}" font-size="20" fill="${pal.muted}" text-anchor="middle">${esc(v.sub)}</text>

  ${statCard(40, "욕설 발생률", m.profanityRate.toFixed(1) + "%", swearNote)}
  ${statCard(244, "구조화 지수", m.competence.toFixed(1) + "%", compNote)}

  <text x="${CX}" y="588" font-family="${FONT}" font-size="15" fill="${pal.faint}" text-anchor="middle">${m.prompts.toLocaleString("en-US")} prompts · npx promptkarma</text>
</svg>`;
}
