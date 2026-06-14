CREATE TABLE "webhook_retry_queue" (
        "id" serial PRIMARY KEY NOT NULL,
        "idempotency_key" text NOT NULL,
        "event_type" text NOT NULL,
        "clerk_user_id" text,
        "payload" jsonb NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "attempt_count" integer DEFAULT 0 NOT NULL,
        "max_attempts" integer DEFAULT 10 NOT NULL,
        "next_retry_at" timestamp with time zone DEFAULT now() NOT NULL,
        "last_error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_retry_queue_idempotency_key_uniq" ON "webhook_retry_queue" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "webhook_retry_queue_status_next_retry_idx" ON "webhook_retry_queue" ("status", "next_retry_at");
