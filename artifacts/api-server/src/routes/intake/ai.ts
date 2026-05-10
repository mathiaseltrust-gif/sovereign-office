import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { runAiIntakeAgent } from "../../sovereign/ai-intake-agent";

const router = Router();

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { text, context } = req.body as {
      text: string;
      context?: {
        caseType?: string;
        actorType?: string;
        landStatus?: string;
        actionType?: string;
        childInvolved?: boolean;
        tribe?: string;
        court?: string;
      };
    };
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text field is required" });
      return;
    }
    const report = await runAiIntakeAgent({ text, context });
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
