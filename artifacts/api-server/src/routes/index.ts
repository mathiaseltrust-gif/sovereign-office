import { Router, type IRouter } from "express";
import healthRouter from "./health";
import trustTemplatesRouter from "./trust/templates";
import trustInstrumentsRouter from "./trust/instruments";
import trustFilingsRouter from "./trust/filings";
import classifyRouter from "./tribal/classify";
import nfrRouter from "./court/nfr";
import complaintsRouter from "./complaints/index";
import calendarRouter from "./calendar/index";
import tasksRouter from "./tasks/index";
import searchRouter from "./search/index";
import userProfileRouter from "./user/profile";
import adminEntraRouter from "./admin/entra";

const router: IRouter = Router();

router.use(healthRouter);

router.use("/trust/templates", trustTemplatesRouter);
router.use("/trust/instruments", trustInstrumentsRouter);
router.use("/trust/filings", trustFilingsRouter);
router.use("/tribal/classify", classifyRouter);
router.use("/court/nfr", nfrRouter);
router.use("/complaints", complaintsRouter);
router.use("/calendar", calendarRouter);
router.use("/tasks", tasksRouter);
router.use("/search", searchRouter);
router.use("/user/profile", userProfileRouter);
router.use("/admin/entra", adminEntraRouter);

export default router;
