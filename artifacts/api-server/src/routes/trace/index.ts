import { Router } from "express";
import mattersRouter from "./matters";
import analysisRouter from "./analysis";
import draftsRouter from "./drafts";
import uploadRouter from "./upload";
import accessRouter from "./access";

const router = Router();

router.use("/matters", mattersRouter);
router.use("/", analysisRouter);
router.use("/matters", draftsRouter);
router.use("/matters", uploadRouter);
router.use("/", accessRouter);

export default router;
