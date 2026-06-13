CREATE TABLE "tier_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"from_tier" text NOT NULL,
	"to_tier" text NOT NULL,
	"triggered_by" text NOT NULL,
	"event_type" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tier_transitions" ADD CONSTRAINT "tier_transitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tier_transitions_user_id_idx" ON "tier_transitions" ("user_id");
--> statement-breakpoint
CREATE INDEX "tier_transitions_created_at_idx" ON "tier_transitions" ("created_at");
