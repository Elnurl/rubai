import { Router, type IRouter } from "express";
import healthRouter from "./health";
import atlasRouter from "./atlas";
import meRouter from "./me";
import { requireAuth } from "../middlewares/requireAuth";
import { aiRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use("/atlas", requireAuth, aiRateLimiter, atlasRouter);

export default router;
