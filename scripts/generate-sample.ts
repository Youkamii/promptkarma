import { writeFileSync } from "node:fs";
import { renderFeedbackCard } from "../src/card.js";
import { METRIC_VERSION } from "../src/metrics.js";

const svg = renderFeedbackCard({
  username: "sample-dev",
  metrics: {
    metricVersion: METRIC_VERSION,
    prompts: 148,
    slash: 0,
    profanityRate: 1.4,
    promptsPerSwear: 71,
    competence: 68.2,
    praiseRate: 0,
    karma: "white",
    eligible: true,
    habits: {
      contextRate: 54.7,
      constraintRate: 18.2,
      stepRate: 45.9,
      outsourceRate: 6.1,
    },
  },
  theme: "black",
  provenance: "local",
  filterVersion: 1,
});

writeFileSync(
  new URL("../public/feedback-sample.svg", import.meta.url),
  svg.replace(/[ \t]+$/gm, "") + "\n",
);
