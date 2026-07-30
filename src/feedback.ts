import { METRIC_VERSION, MIN_SAMPLE, type Metrics } from "./metrics.js";

export interface Feedback {
  status: "collecting" | "ready";
  /** 터미널에 보여줄 쉬운 한국어 제안. */
  tip: string;
  /** SVG 카드에 들어갈 짧은 영문 제안. */
  cardTip: string;
  remaining: number;
}

interface HabitChoice {
  rate: number;
  tip: string;
  cardTip: string;
}

const RECOMMEND_BELOW = 20;
const OUTSOURCE_ABOVE = 20;

/**
 * 가장 적게 관찰된 유용한 습관 하나를 다음 실험으로 고른다.
 * 이 임계값은 능력 합격선이 아니라 추천 문구를 고르는 UI 규칙이다.
 */
export function buildFeedback(metrics: Metrics): Feedback {
  const remaining = Math.max(0, MIN_SAMPLE - metrics.prompts);
  if (!metrics.eligible) {
    return {
      status: "collecting",
      tip: `프롬프트 ${remaining}개를 더 모으면 습관별 피드백을 보여드립니다.`,
      cardTip: `COLLECT ${remaining} MORE PROMPT${remaining === 1 ? "" : "S"}`,
      remaining,
    };
  }

  const h = metrics.habits;
  if (!h) {
    return {
      status: "ready",
      tip: "이 결과는 옛 규칙의 요약값입니다. 다시 스캔하면 맥락·조건·단계·통째 위임 신호가 열립니다.",
      cardTip: "RE-SCAN TO UNLOCK 4 HABIT SIGNALS",
      remaining: 0,
    };
  }

  if (h) {
    if (h.outsourceRate >= OUTSOURCE_ABOVE) {
      return {
        status: "ready",
        tip: "“알아서”라고 맡길 때도 지켜야 할 판단 기준을 한 줄 같이 적어보세요.",
        cardTip: "PAIR DELEGATION WITH A DECISION RULE",
        remaining: 0,
      };
    }
    const choices: HabitChoice[] = [
      {
        rate: h.contextRate,
        tip: "다음 요청에는 대상 파일·코드·링크 중 하나를 먼저 적어보세요.",
        cardTip: "POINT TO A FILE, CODE, OR LINK",
      },
      {
        rate: h.constraintRate,
        tip: "다음 요청에는 지켜야 할 조건이나 완료 기준을 한 줄 적어보세요.",
        cardTip: "ADD A CONSTRAINT OR DONE CHECK",
      },
      {
        rate: h.stepRate,
        tip: "큰 요청은 두 단계 이상의 목록으로 나눠 적어보세요.",
        cardTip: "BREAK THE TASK INTO STEPS",
      },
    ];
    const weakest = choices.reduce((a, b) => b.rate < a.rate ? b : a);
    if (weakest.rate < RECOMMEND_BELOW) {
      return { status: "ready", ...weakest, remaining: 0 };
    }
  }

  if (metrics.profanityRate > 0) {
    return {
      status: "ready",
      tip: "막힌 결과와 원하는 결과를 욕설 대신 한 줄씩 나눠 적어보세요.",
      cardTip: "NAME THE ACTUAL AND WANTED RESULT",
      remaining: 0,
    };
  }

  return {
    status: "ready",
    tip: `규칙 v${METRIC_VERSION} 기준 뚜렷하게 빠진 신호가 없습니다. 다음 작업 뒤 다시 점검해보세요.`,
    cardTip: "RE-SCAN AFTER YOUR NEXT PROJECT",
    remaining: 0,
  };
}
