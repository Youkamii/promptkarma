import { writeFileSync } from "node:fs";
import { renderPolytope } from "../src/card.js";
import { METRIC_VERSION } from "../src/metrics.js";

const svg = renderPolytope({
  username: "your-handle",
  metrics: {
    metricVersion: METRIC_VERSION,
    prompts: 148,
    slash: 0,
    profanityRate: 1.4,
    promptsPerSwear: 71,
    competence: 62,
    praiseRate: 0,
    karma: "white",
    eligible: true,
  },
  theme: "black",
  provenance: "local",
  filterVersion: 1,
});

writeFileSync(
  new URL("../public/badge-sample.svg", import.meta.url),
  svg.replace(/[ \t]+$/gm, "") + "\n",
);
