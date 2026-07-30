import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { renderCard, renderPolytope } from "../src/card.js";
import { METRIC_VERSION, type Metrics } from "../src/metrics.js";

const metrics: Metrics = {
  metricVersion: METRIC_VERSION,
  prompts: 148,
  slash: 0,
  profanityRate: 1.4,
  promptsPerSwear: 71,
  competence: 62,
  praiseRate: 0,
  karma: "white",
  eligible: true,
};

const port = Number(process.env.PORT ?? 3016);
const root = new URL("../public/", import.meta.url);

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(await readFile(new URL("index.html", root)));
      return;
    }
    if (url.pathname === "/badge-sample.svg") {
      response.writeHead(200, { "Content-Type": "image/svg+xml; charset=utf-8" });
      response.end(await readFile(new URL("badge-sample.svg", root)));
      return;
    }
    if (url.pathname === "/api/card") {
      const username = (url.searchParams.get("u") ?? "sample-dev").slice(0, 39) || "sample-dev";
      const style = url.searchParams.get("style");
      const input = {
        username,
        metrics,
        theme: url.searchParams.get("theme") ?? undefined,
        provenance: "local" as const,
        filterVersion: 1,
      };
      const svg = style === "classic"
        ? renderCard(input)
        : renderPolytope(input);
      response.writeHead(200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(svg);
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Preview error");
  }
}).listen(port, "127.0.0.1");

console.log(`promptkarma preview: http://127.0.0.1:${port}`);
