import { Router, type IRouter } from "express";
import { runPipeline } from "../../lib/agents.js";
import { logger } from "../../lib/logger.js";

const router: IRouter = Router();

router.post("/investigate", async (req, res): Promise<void> => {
  const { query, image_base64, image_mime_type } = req.body as {
    query?: string | null;
    image_base64?: string | null;
    image_mime_type?: string | null;
  };

  if (!query && !image_base64) {
    res.status(400).json({ error: "Provide either a query or an uploaded image." });
    return;
  }

  try {
    req.log.info({ query: query?.slice(0, 100) }, "Starting fact-verification pipeline");

    const result = await runPipeline({ query, image_base64, image_mime_type });

    req.log.info(
      { claimCount: result.claims.length, traceLength: result.agent_trace.length },
      "Pipeline complete",
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Pipeline error");

    // Surface quota / rate-limit errors clearly so users know what to fix
    const raw = err instanceof Error ? err.message : String(err);
    const isQuota =
      raw.includes("429") ||
      raw.includes("RESOURCE_EXHAUSTED") ||
      raw.includes("quota") ||
      raw.includes("rate limit");

    if (isQuota) {
      res.status(429).json({
        error:
          "Your Gemini API key has exceeded its free-tier quota. " +
          "Please enable billing at https://ai.google.dev or wait for your quota to reset (usually 24 hours). " +
          "Free-tier keys allow very few requests per day.",
      });
      return;
    }

    const isTavily =
      raw.includes("TAVILY_API_KEY") || raw.includes("Tavily API error");
    if (isTavily) {
      res.status(502).json({
        error:
          "Tavily search API error. Please verify your TAVILY_API_KEY is valid and has remaining credits.",
      });
      return;
    }

    res.status(500).json({ error: raw || "Pipeline failed unexpectedly." });
  }
});

export default router;
