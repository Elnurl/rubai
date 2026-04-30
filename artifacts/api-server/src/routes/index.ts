import { Router, type IRouter } from "express";
import healthRouter from "./health";
import atlasRouter from "./atlas";
import meRouter from "./me";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use("/atlas", requireAuth, atlasRouter);

export default router;
