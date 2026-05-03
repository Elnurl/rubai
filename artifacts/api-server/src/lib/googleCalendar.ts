// Google Calendar via Replit's Google Calendar connector.
// Binding is per-Repl (the workspace owner's Google account), so today this
// reads/writes ONE shared calendar for all signed-in users. Per-user Google
// OAuth would require a separate Clerk/Google flow — out of scope for Faza 2.
import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();
const GCAL = "google-calendar";

export type GCalCalendar = {
  id: string;
  title: string;
  source: string;
  color: string;
  allowsModifications: boolean;
  primary: boolean;
};

export type GCalEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string;
  notes?: string;
};

export type GCalCreateInput = {
  title: string;
  notes?: string;
  startISO: string;
  durationMinutes: number;
};

async function gcal<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await connectors.proxy(GCAL, path, {
    method: init.method ?? "GET",
    headers:
      init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google Calendar ${path} failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}

export async function listGoogleCalendars(): Promise<GCalCalendar[]> {
  const data = await gcal<{
    items?: Array<{
      id: string;
      summary?: string;
      summaryOverride?: string;
      backgroundColor?: string;
      accessRole?: string;
      primary?: boolean;
    }>;
  }>("/users/me/calendarList?minAccessRole=writer");
  return (data.items ?? []).map((c) => ({
    id: c.id,
    title: c.summaryOverride || c.summary || c.id,
    source: "Google",
    color: c.backgroundColor || "#84CC16",
    allowsModifications:
      c.accessRole === "owner" || c.accessRole === "writer",
    primary: Boolean(c.primary),
  }));
}

export async function getGoogleTodayEvents(
  calendarId: string,
  timeZone: string | undefined,
): Promise<GCalEvent[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });
  if (timeZone) params.set("timeZone", timeZone);
  const data = await gcal<{
    items?: Array<{
      id: string;
      summary?: string;
      location?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
  }>(`/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`);
  return (data.items ?? []).map((e) => {
    const startISO = e.start?.dateTime ?? e.start?.date ?? "";
    const endISO = e.end?.dateTime ?? e.end?.date ?? "";
    const allDay = Boolean(e.start?.date && !e.start?.dateTime);
    return {
      id: e.id,
      title: e.summary || "(no title)",
      startDate: startISO,
      endDate: endISO,
      allDay,
      location: e.location,
      notes: e.description,
    };
  });
}

export async function createGoogleEvent(
  calendarId: string,
  input: GCalCreateInput,
  timeZone: string | undefined,
): Promise<string> {
  const start = new Date(input.startISO);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const tz = timeZone || "UTC";
  const data = await gcal<{ id: string }>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: {
        summary: input.title,
        description: input.notes,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
        reminders: {
          useDefault: false,
          overrides: [{ method: "popup", minutes: 10 }],
        },
      },
    },
  );
  return data.id;
}

// Tiny in-memory cache so per-request authorization checks don't hammer
// Google's API. The connector is workspace-shared, so a single cache is fine.
let calendarListCache:
  | { at: number; ids: Set<string>; writableIds: Set<string> }
  | null = null;
const CALENDAR_LIST_TTL_MS = 60_000;

async function getCalendarIdSets(): Promise<{
  ids: Set<string>;
  writableIds: Set<string>;
}> {
  const now = Date.now();
  if (calendarListCache && now - calendarListCache.at < CALENDAR_LIST_TTL_MS) {
    return calendarListCache;
  }
  const cals = await listGoogleCalendars();
  const ids = new Set(cals.map((c) => c.id));
  const writableIds = new Set(
    cals.filter((c) => c.allowsModifications).map((c) => c.id),
  );
  calendarListCache = { at: now, ids, writableIds };
  return calendarListCache;
}

export async function assertCalendarAccess(
  calendarId: string,
  mode: "read" | "write",
): Promise<void> {
  const { ids, writableIds } = await getCalendarIdSets();
  const allowed = mode === "write" ? writableIds : ids;
  if (!allowed.has(calendarId)) {
    const err = new Error("Calendar not accessible");
    (err as Error & { code?: string }).code = "CALENDAR_FORBIDDEN";
    throw err;
  }
}

export async function isGoogleCalendarAvailable(): Promise<boolean> {
  try {
    await gcal("/users/me/calendarList?maxResults=1");
    return true;
  } catch {
    return false;
  }
}
