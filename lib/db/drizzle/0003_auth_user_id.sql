ALTER TABLE "users" RENAME COLUMN "clerk_user_id" TO "auth_user_id";
--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "users_clerk_user_id_unique" TO "users_auth_user_id_unique";
--> statement-breakpoint
ALTER TABLE "webhook_retry_queue" RENAME COLUMN "clerk_user_id" TO "auth_user_id";
