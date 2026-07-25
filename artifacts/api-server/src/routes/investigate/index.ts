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
    const message = err instanceof Error ? err.message : "Pipeline failed";
    req.log.error({ err }, "Pipeline error");
    res.status(500).json({ error: message });
  }
});

export default router;
