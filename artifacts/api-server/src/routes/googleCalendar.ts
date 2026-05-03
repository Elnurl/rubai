import { Router, type IRouter } from "express";
import {
  GoogleCalendarSyncPlanBody as googleCalendarSyncPlanBody,
} from "@workspace/api-zod";
import {
  assertCalendarAccess,
  createGoogleEvent,
  getGoogleTodayEvents,
  isGoogleCalendarAvailable,
  listGoogleCalendars,
} from "../lib/googleCalendar";

function isForbiddenError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "CALENDAR_FORBIDDEN"
  );
}
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/status", async (_req, res): Promise<void> => {
  const available = await isGoogleCalendarAvailable();
  res.json({ available });
});

router.get("/calendars", async (req, res): Promise<void> => {
  try {
    const calendars = await listGoogleCalendars();
    res.json({ calendars });
  } catch (err) {
    req.log.warn({ err }, "google-calendar list failed");
    res.status(503).json({ error: "Google Calendar not connected" });
  }
});

router.get("/today-events", async (req, res): Promise<void> => {
  const calendarId = String(req.query.calendarId ?? "").trim();
  if (!calendarId) {
    res.status(400).json({ error: "calendarId required" });
    return;
  }
  const timeZone = req.query.timeZone
    ? String(req.query.timeZone).trim()
    : undefined;
  try {
    await assertCalendarAccess(calendarId, "read");
    const events = await getGoogleTodayEvents(calendarId, timeZone);
    res.json({ events });
  } catch (err) {
    if (isForbiddenError(err)) {
      res.status(403).json({ error: "Calendar not accessible" });
      return;
    }
    req.log.warn({ err }, "google-calendar events failed");
    res.status(503).json({ error: "Google Calendar fetch failed" });
  }
});

router.post("/sync-plan", async (req, res): Promise<void> => {
  const parsed = googleCalendarSyncPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { calendarId, tasks, timeZone } = parsed.data;
  if (tasks.length === 0) {
    res.json({ written: 0, eventIds: [], successIndices: [] });
    return;
  }
  try {
    await assertCalendarAccess(calendarId, "write");
  } catch (err) {
    if (isForbiddenError(err)) {
      res.status(403).json({ error: "Calendar not writable" });
      return;
    }
    req.log.warn({ err }, "google-calendar authz failed");
    res.status(503).json({ error: "Google Calendar not connected" });
    return;
  }
  // Stack tasks back-to-back from now (rounded up to next quarter hour).
  const cursor = new Date();
  const m = cursor.getMinutes();
  cursor.setMinutes(m + ((15 - (m % 15)) % 15), 0, 0);
  const eventIds: string[] = [];
  const successIndices: number[] = [];
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i]!;
    const dur = Math.max(15, Math.min(t.durationMinutes ?? 30, 240));
    try {
      const id = await createGoogleEvent(
        calendarId,
        {
          title: `rubai · ${t.title}`,
          notes: t.description,
          startISO: cursor.toISOString(),
          durationMinutes: dur,
        },
        timeZone,
      );
      eventIds.push(id);
      successIndices.push(i);
    } catch (err) {
      req.log.warn({ err, taskTitle: t.title }, "google-calendar write failed");
    }
    cursor.setTime(cursor.getTime() + dur * 60 * 1000);
  }
  res.json({ written: eventIds.length, eventIds, successIndices });
});

export default router;
