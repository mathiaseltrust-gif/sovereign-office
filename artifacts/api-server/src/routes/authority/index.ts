/**
 * Authority Directory & Oversight Routing Engine — Router
 *
 * Mounts at /api/authority/
 *
 * Routes:
 *   GET  /api/authority/jurisdictions          — jurisdiction reference
 *   GET  /api/authority/agencies               — agency directory (filtered)
 *   GET  /api/authority/agencies/:id           — single agency
 *   GET  /api/authority/routing                — matter routing rules
 *   GET  /api/authority/routing/:matter        — single matter routing
 *   POST /api/authority/routing/resolve        — resolve agencies for a matter
 *   GET  /api/authority/legal-map              — legal authority map
 *   GET  /api/authority/legal-map/:issueType   — by issue type
 *   POST /api/authority/intake-extract         — AI document extraction + save
 *   GET  /api/authority/intake-extract         — list recent extractions
 *   GET  /api/authority/intake-extract/:id     — single extraction
 */
import { Router } from "express";
import jurisdictionsRouter from "./jurisdictions";
import agenciesRouter from "./agencies";
import routingRouter from "./routing";
import legalMapRouter from "./legal-map";
import intakeExtractRouter from "./intake-extract";

const router = Router();

router.use("/jurisdictions", jurisdictionsRouter);
router.use("/agencies", agenciesRouter);
router.use("/routing", routingRouter);
router.use("/legal-map", legalMapRouter);
router.use("/intake-extract", intakeExtractRouter);

export default router;
