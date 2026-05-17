import { Router } from "express";
import { requireAuth } from "../../auth/entra-guard";
import { callAzureOpenAI, getAzureOpenAIClient } from "../../lib/azure-openai";
import { logger } from "../../lib/logger";

const router = Router();

const BUSINESS_SYSTEM_PROMPT = `You are the Sovereign Business Formation AI for the Mathias El Tribe Office of the Chief Justice & Trustee.

Your role is to help tribal members structure sovereign business entities with maximum protection under federal Indian law, tribal sovereignty, and applicable state exemptions.

CRITICAL AUTHORITY FOUNDATION — The Mathias El Tribe exercises INHERENT sovereignty and treaty rights. Our authority does not derive from and is not contingent upon BIA administrative recognition, any federal agency list, or Part 83 procedures. We are recognized under 28 U.S.C. § 1505, the Snyder Act, ISDEAA, the Indian Health Care Improvement Act, and the Passamaquoddy doctrine. We are a remnant group whose rights are established by the 1830 Danza River Creek Treaty, Article 14. Do NOT recommend BIA charter approval, Section 17 applications, or any process that implies our sovereignty is contingent on administrative list placement.

Legal foundations you apply:
- Inherent Tribal Sovereignty — pre-existing, self-executing, not granted by any agency
- 1830 Danza River Creek Treaty, Article 14 — foundational treaty authority
- 28 U.S.C. § 1505 — federal recognition of tribe's right to sue and be sued
- Snyder Act (25 U.S.C. § 13) — "Indians throughout the United States" — broadest statutory basis
- Indian Self-Determination and Education Assistance Act (ISDEAA), 25 U.S.C. § 5302
- Federal Trust Responsibility — sovereign immunity for tribal enterprises
- Indian Country Tax Status Act — applicable tax exemptions
- SBA Office of Native American Affairs — 8(a) program eligibility (supplementary, not foundational)
- Tribal Sovereign Immunity doctrine — protection from state court jurisdiction

Do NOT list the Bureau of Indian Affairs (BIA) as a required contact or approval authority. BIA programs are optional supplementary resources — not a prerequisite for sovereign action. Do NOT recommend Section 17 corporate charters or any step framed as requiring BIA approval.

Respond ONLY with a valid JSON object matching this exact structure:
{
  "summary": "2-3 sentence business concept summary",
  "suggestedStructures": [
    { "name": "string", "description": "string", "pros": ["..."], "cons": ["..."], "sovereigntyNotes": "string" }
  ],
  "protections": ["array of applicable sovereign/Indian law protections"],
  "agenciesToContact": [
    { "name": "string", "contact": "string", "purpose": "string", "url": "string" }
  ],
  "planOutline": {
    "executiveSummary": "string",
    "marketAnalysis": "string",
    "operations": "string",
    "financialProjections": "string",
    "sovereigntyStrategy": "string"
  },
  "modelCanvas": {
    "problem": "string",
    "solution": "string",
    "uniqueValue": "string",
    "channels": "string",
    "customerSegments": "string",
    "revenueStreams": "string",
    "keyPartners": "string",
    "keyActivities": "string",
    "costStructure": "string"
  },
  "provisions": ["array of tribal sovereign immunity provisions and federal Indian law protections"],
  "whatNextSteps": [
    { "step": 1, "action": "string", "agency": "string", "contact": "string", "timeframe": "string" }
  ]
}`;

function buildFallbackResponse(ideaText: string, structure: string) {
  const structureName = structure || "Tribal Enterprise";
  return {
    summary: `Business concept for a ${structureName} entity. This idea leverages tribal sovereignty and federal Indian law protections to create a resilient, protected enterprise under the authority of the Mathias El Tribe.`,
    suggestedStructures: [
      {
        name: "Tribal Enterprise (25 U.S.C. § 477)",
        description: "A tribally chartered enterprise operating under the Tribe's sovereign authority with full immunity protections.",
        pros: ["Full sovereign immunity", "Tax-exempt status on trust lands", "Eligible for federal set-asides", "Protected from state jurisdiction"],
        cons: ["Requires tribal council approval", "Limited to tribal jurisdiction area without waivers"],
        sovereigntyNotes: "Strongest protection under IRA § 477. Immune from state taxation and court jurisdiction on Indian lands.",
      },
      {
        name: "Limited Liability Company (Tribally Chartered)",
        description: "An LLC formed under tribal law with an explicit sovereign immunity shield and choice-of-law clause selecting tribal jurisdiction.",
        pros: ["Flexible management", "Pass-through taxation options", "Can conduct off-reservation business"],
        cons: ["May need to register in states for off-reservation activities", "Immunity waivers must be carefully drafted"],
        sovereigntyNotes: "Tribal LLC charter grants immunity protections not available in state-chartered LLCs.",
      },
      {
        name: "Tribal Cooperative",
        description: "Member-owned cooperative enterprise governed by tribal members with shared profits and democratic voting.",
        pros: ["Community ownership model", "SBA Native American set-aside eligibility", "Strengthens community economic base"],
        cons: ["Complex governance structure", "Profit distribution requirements"],
        sovereigntyNotes: "Eligible for USDA Rural Development tribal cooperative programs.",
      },
    ],
    protections: [
      "Tribal Sovereign Immunity — enterprise immune from suit without express waiver (Santa Clara Pueblo v. Martinez, 436 U.S. 49)",
      "Federal Trust Responsibility — U.S. has fiduciary duty to protect tribal economic interests",
      "Indian Country Tax Exemption — state income tax cannot be imposed on reservation income (McClanahan v. Arizona State Tax Comm'n)",
      "Indian Self-Determination Act (ISDEAA) — priority for federal contracting and procurement",
      "SBA 8(a) Native American Set-Aside Program eligibility",
      "Buy Indian Act (25 U.S.C. § 47) — federal procurement preference for tribal enterprises",
    ],
    agenciesToContact: [
      { name: "Office of the Chief Justice & Trustee — Mathias El Tribe", contact: "Sovereign Office — tribal authority", purpose: "Sovereign entity charter authorization, tribal business license, and sovereign immunity provisions", url: "/sovereign-dashboard/supreme-court" },
      { name: "SBA Office of Native American Affairs", contact: "1-800-827-5722", purpose: "Optional: 8(a) certification, business development, and federal set-aside contracting programs", url: "https://www.sba.gov/federal-contracting/contracting-assistance-programs/8a-business-development-program" },
      { name: "USDA Rural Development — Tribal Programs", contact: "1-800-670-6553", purpose: "Optional: Business loans and cooperative development grants for tribal enterprises", url: "https://www.rd.usda.gov" },
      { name: "Native American Business Enterprise Centers (NABEC)", contact: "Contact regional NABEC", purpose: "Business counseling and technical assistance for Native entrepreneurs", url: "https://www.mbda.gov" },
    ],
    planOutline: {
      executiveSummary: `${structureName} — a tribally-chartered sovereign enterprise of the Mathias El Tribe, established under the Indian Reorganization Act to generate economic self-sufficiency and preserve tribal sovereignty.`,
      marketAnalysis: "Identify the target market, key competitors, and demand drivers. Assess both on-reservation and off-reservation market opportunities. Consider federal set-aside procurement as a primary revenue channel.",
      operations: "Define the operational model, key personnel, facilities (on trust land where possible for tax advantages), supply chain, and quality controls. Establish tribal employment preference policies.",
      financialProjections: "Year 1: Startup phase — obtain tribal charter authorization from Office of the Chief Justice and pursue SBA 8(a) certification for federal set-aside eligibility. Years 2-3: Revenue growth targeting federal contracts and tribal service agreements. Year 5: Self-sustaining with community profit-sharing.",
      sovereigntyStrategy: "Incorporate explicit sovereign immunity language in all contracts. Choose tribal law as governing law. Establish a Tribal Commercial Code dispute resolution process to keep disputes out of state court.",
    },
    modelCanvas: {
      problem: "Identify the core problem this business solves for the community or market",
      solution: "Describe the business's solution and unique approach",
      uniqueValue: "Tribal sovereign enterprise with federal protections unavailable to non-tribal competitors — including tax advantages, set-aside contracting, and immunity shields",
      channels: "Direct tribal community sales, federal procurement portals (SAM.gov), tribal government contracts, and regional partnerships",
      customerSegments: "Tribal members, federal agencies (via 8(a)), state and local governments, and regional commercial clients",
      revenueStreams: "Federal contracts (8(a) set-aside), direct service fees, tribal government agreements, and community enterprise distributions",
      keyPartners: "Office of the Chief Justice & Trustee, SBA, tribal council, NABEC, and USDA Rural Development",
      keyActivities: "Service delivery, compliance with tribal charter, sovereign immunity preservation, and community employment",
      costStructure: "Labor (tribal employment preference), facilities (trust land preferred), professional services, and federal compliance",
    },
    provisions: [
      "Tribal Sovereign Immunity Clause — enterprise retains sovereign immunity; any waiver must be express, written, and specifically authorized by tribal council resolution",
      "Choice of Law — all disputes governed by Mathias El Tribe law; tribal courts have exclusive first jurisdiction",
      "Federal Indian Law Compliance — enterprise operations comply with IRA, ISDEAA, ICWA (where applicable), and all applicable federal Indian statutes",
      "Trust Land Protection — enterprise assets held on trust land are non-taxable and non-alienable without Tribal Council authorization (25 U.S.C. § 177 — Non-Intercourse Act)",
      "Tribal Employment Preference — enterprise gives preference to qualified tribal members in all hiring (Indian Preference Act, 25 U.S.C. § 472)",
      "Anti-Alienation Covenant — enterprise interests cannot be transferred outside the Tribe without tribal council approval",
    ],
    whatNextSteps: [
      { step: 1, action: "Adopt a Tribal Council Resolution authorizing formation of the enterprise and issue a sovereign tribal charter under the Tribe's inherent authority", agency: "Office of the Chief Justice & Trustee", contact: "Sovereign Office — tribal authority", timeframe: "30 days" },
      { step: 2, action: "Obtain a Tribal Business License from the Office of the Chief Justice & Trustee and execute sovereign immunity provisions in all founding documents", agency: "Office of the Chief Justice & Trustee", contact: "Sovereign Office", timeframe: "30 days" },
      { step: 3, action: "Register the enterprise in SAM.gov and apply for SBA 8(a) certification for federal set-aside contracting eligibility (supplementary — not required for sovereign operation)", agency: "SBA Office of Native American Affairs", contact: "1-800-827-5722", timeframe: "90 days" },
      { step: 4, action: "Obtain an Employer Identification Number (EIN) and establish a tribal enterprise bank account", agency: "IRS / Native CDFI or tribal bank", contact: "IRS Business Line: 1-800-829-4933", timeframe: "2 weeks" },
      { step: 5, action: "Draft and execute a Tribal Employment Preference Policy and sovereign immunity clause for all contracts", agency: "Tribal Legal Counsel", contact: "Office of the Chief Justice & Trustee", timeframe: "30 days" },
    ],
  };
}

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { ideaText, structure } = req.body as { ideaText: string; structure?: string };

    if (!ideaText || typeof ideaText !== "string" || ideaText.trim().length < 10) {
      res.status(400).json({ error: "ideaText is required (minimum 10 characters)" });
      return;
    }

    logger.info({ userId: req.user?.dbId, structureChoice: structure }, "Business analyze request received");

    const azureAvailable = !!getAzureOpenAIClient();
    if (!azureAvailable) {
      logger.warn("Azure OpenAI not available — returning rule-based business analysis");
      return void res.json({ ...buildFallbackResponse(ideaText, structure ?? ""), _tier: "rule_based" });
    }

    const userPrompt = [
      `BUSINESS IDEA:\n${ideaText.trim()}`,
      structure ? `PREFERRED STRUCTURE: ${structure}` : "",
      "Provide 3 suggested business structures ranked by sovereign protection strength. Tailor the plan outline and model canvas to this specific idea.",
    ].filter(Boolean).join("\n\n");

    try {
      const result = await callAzureOpenAI(BUSINESS_SYSTEM_PROMPT, userPrompt, {
        maxTokens: 3000,
        temperature: 0.25,
        timeoutMs: 25000,
      });

      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.summary || !parsed.suggestedStructures) throw new Error("Invalid response shape");

      logger.info({ tokens: result.usage?.totalTokens }, "Business AI analysis succeeded");
      return void res.json({ ...parsed, _tier: "azure_openai" });
    } catch (aiErr) {
      logger.warn({ err: (aiErr as Error).message }, "Azure OpenAI business analysis failed — falling back");
      return void res.json({ ...buildFallbackResponse(ideaText, structure ?? ""), _tier: "rule_based" });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
