import { db, behavioralEventsTable } from "@workspace/db";

export type BehavioralEventType =
  | "message_sent"
  | "task_completed"
  | "task_skipped"
  | "task_created"
  | "session_started"
  | "coach_opened"
  | "goal_viewed";

export interface BehavioralEventMeta {
  /** OpenAI moderation sentiment proxy: 1=positive, 0=neutral, -1=negative */
  sentimentScore?: number;
  messageLength?: number;
  hourOfDay?: number;
  dayOfWeek?: number;
  taskId?: string;
  taskTitle?: string;
  /** Minutes between task creation and completion */
  completionSpeedMinutes?: number;
  /** Days the task was overdue when finally addressed */
  delayDays?: number;
}

/**
 * Fire-and-forget: logs a behavioral event. Never throws or blocks the
 * caller — if the insert fails it is silently swallowed. All timestamps
 * are server-side (createdAt defaultNow() in the schema).
 */
export function logBehavioralEvent(
  userId: number,
  eventType: BehavioralEventType,
  meta: BehavioralEventMeta = {},
): void {
  const now = new Date();
  const enriched: BehavioralEventMeta = {
    hourOfDay: now.getHours(),
    dayOfWeek: now.getDay(),
    ...meta,
  };

  db.insert(behavioralEventsTable)
    .values({
      userId,
      eventType,
      sentimentScore: enriched.sentimentScore ?? null,
      metadata: enriched,
    })
    .catch(() => {
      // intentional no-op — behavioral telemetry must never surface errors
    });
}
