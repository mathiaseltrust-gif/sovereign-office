/**
 * POST /api/github/intake
 *
 * Dry-run endpoint for the GitHub Issues intake pipeline.
 * Accepts a parsed issue payload from the GitHub Action parser,
 * validates fields, runs optional AI extraction, and returns a
 * draft preview — without writing to the DB unless dryRun=false.
 *
 * Auth: X-Api-Key header (SERVICE_KEY) OR Bearer session token.
 */
import { Router } from "express";
import { logger } from "../../lib/logger";

const router = Router();

// ── Auth: service key OR bearer token ────────────────────────────────────────
function checkAuth(req: import("express").Request): boolean {
  const apiKey = req.headers["x-api-key"];
  const serviceKey = process.env.SERVICE_KEY || process.env.M365_SERVICE_KEY;
  if (serviceKey && apiKey === serviceKey) return true;

  const auth = req.headers["authorization"] ?? "";
  if (auth.startsWith("Bearer ") && auth.length > 10) return true;

  return false;
}

// ── Mock extraction fallback ──────────────────────────────────────────────────
function mockExtract(title: string, body: string) {
  const combined = (title + " " + body).toLowerCase();

  let matterType = "general";
  if (/land|allotment|parcel|trust land|apn|acreage/.test(combined)) matterType = "land";
  else if (/member|enrollment|blood|cdib|roll/.test(combined)) matterType = "membership";
  else if (/child|welfare|icwa|foster|custody/.test(combined)) matterType = "child_welfare";
  else if (/treaty|sovereign rights/.test(combined)) matterType = "treaty_rights";
  else if (/probate|estate|inheritance|decedent/.test(combined)) matterType = "probate";

  let urgency = "medium";
  if (/urgent|emergency|immediate|critical/.test(combined)) urgency = "high";
  else if (/low priority|routine/.test(combined)) urgency = "low";

  const partyMatch = body.match(/parties?:\s*([^\n]+)/i);
  const parties = partyMatch
    ? partyMatch[1].split(",").map((p) => p.trim()).filter(Boolean)
    : ["[Not detected]"];

  const deadlineMatch = body.match(/deadline:\s*([^\n]+)/i);
  const deadline = deadlineMatch ? deadlineMatch[1].trim() : null;

  const stateMatch = body.match(/state:\s*([A-Z]{2})/i);
  const countyMatch = body.match(/county:\s*([^\n]+)/i);

  const flags: string[] = [];
  if (/icwa|indian child welfare/.test(combined)) flags.push("ICWA");
  if (/trust land|trust status/.test(combined)) flags.push("trust_land");
  if (/federal review|25 cfr/.test(combined)) flags.push("federal_review");
  if (/treaty|25 usc/.test(combined)) flags.push("treaty_rights");
  if (/enrolled member|tribal member/.test(combined)) flags.push("enrolled_member");

  const instruments = ["Complaint Filing"];
  if (matterType === "land") instruments.push("Notice of Trust Claim", "BIA Trust Determination Letter");
  if (matterType === "child_welfare") instruments.push("ICWA Notice", "ICWA Intervention Motion");
  if (flags.includes("treaty_rights")) instruments.push("Treaty Rights Assertion");
  if (flags.includes("federal_review")) instruments.push("Federal Review Request (25 CFR)");

  return {
    extractionMethod: "mock_parser_v1",
    matterType,
    urgency,
    parties,
    deadline,
    state: stateMatch ? stateMatch[1].toUpperCase() : null,
    county: countyMatch ? countyMatch[1].trim() : null,
    legalFlags: flags,
    recommendedInstruments: instruments,
    confidence: 0.65,
    note: "Mock extraction — Azure OpenAI not used in this request",
  };
}

// ── POST /api/github/intake ───────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    if (!checkAuth(req)) {
      res.status(401).json({ error: "Unauthorized — provide X-Api-Key or Bearer token" });
      return;
    }

    const {
      issueNumber,
      issueTitle,
      issueBody,
      labels = [],
      repository,
      sender,
      dryRun = true,
      extracted: preExtracted,
    } = req.body as {
      issueNumber?: number | null;
      issueTitle: string;
      issueBody: string;
      labels?: string[];
      repository?: string;
      sender?: string;
      dryRun?: boolean;
      extracted?: Record<string, unknown>;
    };

    // Validate required fields
    if (!issueTitle || typeof issueTitle !== "string") {
      res.status(400).json({ error: "issueTitle is required" });
      return;
    }
    if (!issueBody || typeof issueBody !== "string") {
      res.status(400).json({ error: "issueBody is required" });
      return;
    }
    if (issueBody.length > 50_000) {
      res.status(400).json({ error: "issueBody exceeds 50 000 character limit" });
      return;
    }

    // Use pre-extracted data (from Action) or run mock extraction
    const extraction = preExtracted && typeof preExtracted === "object"
      ? preExtracted
      : mockExtract(issueTitle, issueBody);

    // Build draft preview (what WOULD be created)
    const draftPreview = {
      title: `[GitHub #${issueNumber ?? "?"}] ${issueTitle}`,
      matterType: extraction.matterType,
      urgency: extraction.urgency,
      parties: extraction.parties,
      deadline: extraction.deadline,
      state: extraction.state,
      county: extraction.county,
      legalFlags: extraction.legalFlags,
      recommendedInstruments: extraction.recommendedInstruments,
      sourceIssue: issueNumber ? { number: issueNumber, repository } : null,
      status: "pending_review",
      suggestedLabels: [
        "ai-reviewed",
        `case-type:${extraction.matterType}`,
        `urgency:${extraction.urgency}`,
      ],
    };

    // Log regardless of dry-run
    logger.info({
      event: "github_intake",
      dryRun,
      issueNumber,
      issueTitle,
      repository,
      sender,
      matterType: extraction.matterType,
      urgency: extraction.urgency,
      confidence: extraction.confidence,
    });

    if (dryRun !== false) {
      // ── DRY RUN — return preview, no DB writes ──────────────────────────
      res.json({
        mode: "dry_run",
        dryRun: true,
        message: "Preview generated. Set dryRun=false to create a real draft record.",
        issueNumber,
        issueTitle,
        repository,
        extraction,
        draftPreview,
        pipelineSteps: [
          { step: 1, name: "Document Upload",       status: "complete" },
          { step: 2, name: "GitHub Issue Created",  status: "complete" },
          { step: 3, name: "Action Parser",         status: "complete" },
          { step: 4, name: "AI Extraction",         status: "complete", method: (extraction as Record<string, unknown>).extractionMethod ?? "mock" },
          { step: 5, name: "Draft Record Created",  status: "skipped",  reason: "dryRun=true" },
          { step: 6, name: "Officer Review",        status: "pending",  reason: "Awaiting draft creation" },
        ],
      });
      return;
    }

    // ── LIVE MODE — not yet implemented ────────────────────────────────────
    // When dryRun=false is enabled, insert into pipelineRecordsTable here.
    res.status(501).json({
      error: "Live mode (dryRun=false) is not yet enabled. This endpoint is in dry-run preview only.",
      hint: "Set dryRun=true or omit the field to use preview mode.",
    });
  } catch (err) {
    next(err);
  }
});

export default router;
