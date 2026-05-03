import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export type LightCalendar = {
  id: string;
  title: string;
  source: string;
  color: string;
  allowsModifications: boolean;
};

export type LightEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  notes?: string;
};

export async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

export async function getCalendarPermissionStatus(): Promise<
  "granted" | "denied" | "undetermined"
> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function listWritableCalendars(): Promise<LightCalendar[]> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  return calendars
    .filter((c) => c.allowsModifications)
    .map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source?.name ?? "",
      color: c.color ?? "#84CC16",
      allowsModifications: c.allowsModifications,
    }));
}

export async function getTodayEvents(
  calendarIds?: string[],
): Promise<LightEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  let ids = calendarIds;
  if (!ids || ids.length === 0) {
    const all = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    ids = all.map((c) => c.id);
  }
  if (ids.length === 0) return [];

  const events = await Calendar.getEventsAsync(ids, start, end);
  return events.map((e) => ({
    id: e.id,
    title: e.title || "(no title)",
    startDate:
      typeof e.startDate === "string"
        ? e.startDate
        : new Date(e.startDate).toISOString(),
    endDate:
      typeof e.endDate === "string"
        ? e.endDate
        : new Date(e.endDate).toISOString(),
    allDay: Boolean(e.allDay),
    location: e.location ?? undefined,
    notes: e.notes ?? undefined,
  }));
}

export type TaskEventInput = {
  title: string;
  notes?: string;
  startISO: string;
  durationMinutes?: number;
};

export async function createTaskEvent(
  calendarId: string,
  input: TaskEventInput,
): Promise<string> {
  const start = new Date(input.startISO);
  const end = new Date(
    start.getTime() + (input.durationMinutes ?? 30) * 60 * 1000,
  );
  const id = await Calendar.createEventAsync(calendarId, {
    title: input.title,
    notes: input.notes,
    startDate: start,
    endDate: end,
    timeZone: Platform.OS === "ios" ? undefined : "UTC",
    alarms: [{ relativeOffset: -10 }],
  });
  return id;
}

export async function deleteEventSafe(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // event may already be gone — ignore
  }
}

type CalendarSyncLike = {
  enabled: boolean;
  calendarId: string | null;
  contextRead: boolean;
  autoWrite: boolean;
};

type DailyPlanLike = {
  date: string;
  focusOfTheDay: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    durationMinutes: number;
  }>;
};

const writtenPlanKey = (date: string) => `rubai:calendar:written:${date}`;
const writtenPlanIds = new Map<string, Set<string>>();

export async function loadCalendarContextIfEnabled(
  prefs: CalendarSyncLike | undefined,
): Promise<string | undefined> {
  if (!prefs || !prefs.enabled || !prefs.contextRead) return undefined;
  if (Platform.OS === "web") return undefined;
  try {
    const status = await getCalendarPermissionStatus();
    if (status !== "granted") return undefined;
    const events = await getTodayEvents();
    const summary = summarizeEventsForPrompt(events);
    return summary;
  } catch {
    return undefined;
  }
}

export type WriteOutcome =
  | { ok: true; written: number }
  | {
      ok: false;
      reason:
        | "web"
        | "no-permission"
        | "no-calendar"
        | "no-plan"
        | "disabled";
    };

async function writeTasksToCalendar(
  calendarId: string,
  plan: DailyPlanLike,
): Promise<number> {
  const dedupeKey = writtenPlanKey(plan.date);
  let already = writtenPlanIds.get(dedupeKey);
  if (!already) {
    already = new Set<string>();
    writtenPlanIds.set(dedupeKey, already);
  }
  let written = 0;
  // Schedule sequentially from now (rounded up to next quarter hour),
  // stacking back-to-back so events never collide. We don't try to dodge
  // existing events here — the AI prompt already plans around them.
  const cursor = new Date();
  const m = cursor.getMinutes();
  const roundUp = (15 - (m % 15)) % 15;
  cursor.setMinutes(m + roundUp, 0, 0);
  for (const task of plan.tasks) {
    if (already.has(task.id)) continue;
    const dur = Math.max(15, Math.min(task.durationMinutes || 30, 240));
    try {
      await createTaskEvent(calendarId, {
        title: `rubai · ${task.title}`,
        notes: task.description,
        startISO: cursor.toISOString(),
        durationMinutes: dur,
      });
      already.add(task.id);
      written += 1;
    } catch {
      // Skip individual failures; keep going.
    }
    cursor.setTime(cursor.getTime() + dur * 60 * 1000);
  }
  return written;
}

export async function writePlanToCalendarIfEnabled(
  prefs: CalendarSyncLike | undefined,
  plan: DailyPlanLike | null | undefined,
  _reminderTime: string,
): Promise<void> {
  if (!prefs || !prefs.enabled || !prefs.autoWrite || !prefs.calendarId) return;
  if (!plan || !plan.tasks || plan.tasks.length === 0) return;
  if (Platform.OS === "web") return;
  try {
    const status = await getCalendarPermissionStatus();
    if (status !== "granted") return;
    await writeTasksToCalendar(prefs.calendarId, plan);
  } catch {
    // best-effort; do not block plan generation
  }
}

/**
 * On-demand calendar write triggered by an AI proposed action the user
 * confirmed. Unlike the auto-write path this ignores `autoWrite` and surfaces
 * a structured outcome so the UI can prompt the user when permission /
 * calendar selection is missing.
 */
export async function writePlanToCalendarOnDemand(
  prefs: CalendarSyncLike | undefined,
  plan: DailyPlanLike | null | undefined,
): Promise<WriteOutcome> {
  if (Platform.OS === "web") return { ok: false, reason: "web" };
  if (!plan || !plan.tasks || plan.tasks.length === 0) {
    return { ok: false, reason: "no-plan" };
  }
  const status = await getCalendarPermissionStatus();
  if (status !== "granted") return { ok: false, reason: "no-permission" };
  if (!prefs || !prefs.calendarId) return { ok: false, reason: "no-calendar" };
  const written = await writeTasksToCalendar(prefs.calendarId, plan);
  return { ok: true, written };
}

export function summarizeEventsForPrompt(events: LightEvent[]): string {
  if (events.length === 0) return "No calendar events scheduled today.";
  const lines = events
    .slice(0, 8)
    .map((e) => {
      if (e.allDay) return `• All-day: ${e.title}`;
      const t = new Date(e.startDate);
      const time = t.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `• ${time} — ${e.title}${e.location ? ` (${e.location})` : ""}`;
    })
    .join("\n");
  return `Today's calendar:\n${lines}`;
}
