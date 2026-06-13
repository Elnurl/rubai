import { Router, type IRouter } from "express";
import healthRouter from "./health";
import atlasRouter from "./atlas";
import googleCalendarRouter from "./googleCalendar";
import legalRouter from "./legal";
import meRouter from "./me";
import webhooksRouter from "./webhooks";
import { requireAuth } from "../middlewares/requireAuth";
import { aiRateLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.use(healthRouter);
// Webhooks mount BEFORE requireAuth — RevenueCat posts without user auth.
router.use(webhooksRouter);
// Legal routes mount BEFORE meRouter because meRouter installs requireAuth
// as a router-level middleware that, due to Express middleware ordering,
// would otherwise reject unauthenticated requests for /legal/current and
// /legal/document (both of which are intentionally public so the consent
// screen can render the documents). The /legal/me and /legal/accept
// handlers wire requireAuth on themselves individually.
router.use(legalRouter);
router.use(meRouter);
router.use("/atlas", requireAuth, aiRateLimiter, atlasRouter);
router.use("/google-calendar", googleCalendarRouter);

export default router;
