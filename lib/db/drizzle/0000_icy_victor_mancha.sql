CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "ai_usage" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "route" text NOT NULL,
        "model" text NOT NULL,
        "input_tokens" integer,
        "output_tokens" integer,
        "latency_ms" integer,
        "status" text NOT NULL,
        "error_message" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer,
        "event_type" text NOT NULL,
        "payload" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "behavioral_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "event_type" text NOT NULL,
        "sentiment_score" real,
        "metadata" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
        "id" serial PRIMARY KEY NOT NULL,
        "title" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "conversation_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "provider" text NOT NULL,
        "product_id" text NOT NULL,
        "status" text NOT NULL,
        "current_period_end" timestamp with time zone,
        "store_transaction_id" text,
        "raw" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "clerk_user_id" text NOT NULL,
        "email" text,
        "tier" text DEFAULT 'free' NOT NULL,
        "expo_push_token" text,
        "tz_offset_minutes" integer,
        "last_morning_nudge_date" text,
        "embedding_fingerprint" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_state" (
        "user_id" integer PRIMARY KEY NOT NULL,
        "goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "active_goal_id" text,
        "account_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "pending_draft" jsonb,
        "version" integer DEFAULT 0 NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_behavioral_state" (
        "user_id" integer PRIMARY KEY NOT NULL,
        "energy_level" real DEFAULT 0.5 NOT NULL,
        "mood_score" real DEFAULT 0 NOT NULL,
        "cognitive_load" real DEFAULT 0.5 NOT NULL,
        "procrastination_risk" text DEFAULT 'low' NOT NULL,
        "flow_detected" boolean DEFAULT false NOT NULL,
        "peak_hours" jsonb DEFAULT '[]'::jsonb NOT NULL,
        "motivation_type" text DEFAULT 'balanced' NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "document" text NOT NULL,
        "version" text NOT NULL,
        "locale" text NOT NULL,
        "ip_hash" text,
        "user_agent" text,
        "accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
        "id" serial PRIMARY KEY NOT NULL,
        "user_id" integer NOT NULL,
        "goal_id" text,
        "content_type" text NOT NULL,
        "content_id" text NOT NULL,
        "source_text" text NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "model" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavioral_events" ADD CONSTRAINT "behavioral_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_state" ADD CONSTRAINT "user_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_behavioral_state" ADD CONSTRAINT "user_behavioral_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_acceptances" ADD CONSTRAINT "legal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_user_idx" ON "ai_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_created_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_route_idx" ON "ai_usage" USING btree ("route");--> statement-breakpoint
CREATE INDEX "analytics_events_type_idx" ON "analytics_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "analytics_events_created_idx" ON "analytics_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_user_idx" ON "analytics_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "beh_events_user_idx" ON "behavioral_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "beh_events_created_idx" ON "behavioral_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "beh_events_type_idx" ON "behavioral_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "beh_events_user_created_idx" ON "behavioral_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_provider_txn_uniq" ON "subscriptions" USING btree ("provider","store_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "legal_user_doc_version_idx" ON "legal_acceptances" USING btree ("user_id","document","version");--> statement-breakpoint
CREATE INDEX "legal_user_idx" ON "legal_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_user_type_content_uq" ON "embeddings" USING btree ("user_id","content_type","content_id");--> statement-breakpoint
CREATE INDEX "embeddings_user_goal_type_idx" ON "embeddings" USING btree ("user_id","goal_id","content_type");--> statement-breakpoint
CREATE INDEX "embeddings_vec_hnsw_idx" ON "embeddings" USING hnsw (embedding vector_cosine_ops);