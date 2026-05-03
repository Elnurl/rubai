// Thin wrapper around the server-side Google Calendar routes. The actual
// OAuth + token refresh is handled by the api-server via Replit's
// `@replit/connectors-sdk`. This module just shapes requests/responses for
// the mobile UI and the calendar dispatcher in `lib/calendar.ts`.
import {
  googleCalendarStatus,
  googleCalendarList,
  googleCalendarTodayEvents,
  googleCalendarSyncPlan,
  type GoogleCalendarLite,
  type GoogleCalendarEventLite,
} from "@workspace/api-client-react";

export type GoogleLightCalendar = GoogleCalendarLite;
export type GoogleLightEvent = GoogleCalendarEventLite;

export async function isGoogleCalendarAvailable(): Promise<boolean> {
  try {
    const res = await googleCalendarStatus();
    return Boolean(res.available);
  } catch {
    return false;
  }
}

export async function listGoogleWritableCalendars(): Promise<GoogleLightCalendar[]> {
  const res = await googleCalendarList();
  return res.calendars.filter((c) => c.allowsModifications);
}

export async function getGoogleTodayEvents(
  calendarId: string,
): Promise<GoogleLightEvent[]> {
  const tz =
    Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? undefined;
  const res = await googleCalendarTodayEvents({
    calendarId,
    ...(tz ? { timeZone: tz } : {}),
  });
  return res.events;
}

export type GoogleSyncTask = {
  title: string;
  description?: string;
  durationMinutes?: number;
};

export async function syncTasksToGoogleCalendar(
  calendarId: string,
  tasks: GoogleSyncTask[],
): Promise<{ written: number; eventIds: string[]; successIndices: number[] }> {
  const tz =
    Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone ?? undefined;
  return await googleCalendarSyncPlan({
    calendarId,
    tasks,
    ...(tz ? { timeZone: tz } : {}),
  });
}

export function summarizeGoogleEventsForPrompt(
  events: GoogleLightEvent[],
): string {
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
