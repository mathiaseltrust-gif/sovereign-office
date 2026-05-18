/**
 * Authority Directory & Oversight Routing Engine — Router
 *
 * Mounts at /api/authority/
 *
 * Routes:
 *   GET  /api/authority/jurisdiction              — hierarchical: states → counties → cities
 *   GET  /api/authority/agencies                  — filtered agency directory (≥1 param required, max 50)
 *   GET  /api/authority/agencies/:id              — single agency by ID
 *   POST /api/authority/agencies                  — add/upsert agency (officer role required)
 *   GET  /api/authority/matters                   — matter routing rules (filterable by ?matterType)
 *   GET  /api/authority/matters/:matterType       — single matter routing rule
 *   POST /api/authority/matters/resolve           — resolve agencies for a matter
 *   GET  /api/authority/legal-map                 — legal authority map (filterable by ?issueType, ?federalAuthority, ?q)
 *   GET  /api/authority/legal-map/:issueType      — legal authorities for a specific issue type
 *   POST /api/authority/intake/analyze            — AI document extraction + routing recommendation + persist
 *   GET  /api/authority/intake                    — list recent extractions
 *   GET  /api/authority/intake/:id                — single extraction result
 *   GET  /api/authority/sync                      — admin-only: re-run Census + Socrata + federal ingestion
 */
import { Router } from "express";
import jurisdictionRouter from "./jurisdiction";
import agenciesRouter from "./agencies";
import mattersRouter from "./matters";
import legalMapRouter from "./legal-map";
import intakeRouter from "./intake";
import syncRouter from "./sync";

const router = Router();

router.use("/jurisdiction", jurisdictionRouter);
router.use("/agencies", agenciesRouter);
router.use("/matters", mattersRouter);
router.use("/legal-map", legalMapRouter);
router.use("/intake", intakeRouter);
router.use("/sync", syncRouter);

export default router;
