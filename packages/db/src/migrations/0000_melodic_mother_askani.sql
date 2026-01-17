CREATE TYPE "public"."country" AS ENUM('gb', 'es', 'fr', 'ua');--> statement-breakpoint
CREATE TYPE "public"."depth_enum" AS ENUM('1', '2', '3');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'es', 'fr', 'ukr');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backoffice_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bo_user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now(),
	"token" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "bo_user_sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "comment_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connector_type" text,
	"tempo_secs" integer,
	"fetch_period_minutes" integer,
	"language" "language",
	"active" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "detox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"link" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digital_detox_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" varchar DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "digital_detox_sessions_end_date_check" CHECK (end_date >= start_date)
);
--> statement-breakpoint
CREATE TABLE "gifs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"url" text NOT NULL,
	"provider" text NOT NULL,
	CONSTRAINT "gifs_post_id_key" UNIQUE("post_id"),
	CONSTRAINT "gifs_url_key" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "interest_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"interest" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "interests" (
	"id" text PRIMARY KEY NOT NULL,
	"name_en" text,
	"name_es" text,
	"name_fr" text,
	"name_ukr" text,
	"color" text,
	"active" boolean,
	"is_deleted" boolean DEFAULT false,
	"parent_id" text,
	"depth" text
);
--> statement-breakpoint
CREATE TABLE "post2interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"interest_id" text,
	"is_deleted" boolean
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" uuid,
	"content" text,
	"is_deleted" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"gif_url" text
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_deleted" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"mediaType" text,
	"mediaUrl" text NOT NULL,
	"is_deleted" boolean,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" text,
	"topic" text,
	"tags" text[],
	"connector_id" uuid NOT NULL,
	"source_key" text,
	"source_link" text,
	"language" "language",
	"publishing_date" timestamp(6),
	"ai_checked" timestamp(6),
	"content" text,
	"is_deleted" boolean,
	"created_date" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userInterests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"interest_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"is_deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bo_user_sessions" ADD CONSTRAINT "bo_user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."backoffice_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detox_events" ADD CONSTRAINT "detox_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."digital_detox_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gifs" ADD CONSTRAINT "gifs_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE "post2interest" ADD CONSTRAINT "post2interest_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "public"."connectors"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "userInterests" ADD CONSTRAINT "userInterests_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "backoffice_users_email_key" ON "backoffice_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_bo_user_sessions_token" ON "bo_user_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_bo_user_sessions_user_id" ON "bo_user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comment_likes_user_id_idx" ON "comment_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_detox_events_session_id_deleted" ON "detox_events" USING btree ("session_id","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_digital_detox_sessions_dates" ON "digital_detox_sessions" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_digital_detox_sessions_status_deleted" ON "digital_detox_sessions" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_interest_requests_accepted_created_at" ON "interest_requests" USING btree ("accepted","created_at");--> statement-breakpoint
CREATE INDEX "idx_interest_requests_interest" ON "interest_requests" USING btree ("interest");--> statement-breakpoint
CREATE INDEX "idx_interest_requests_user_email" ON "interest_requests" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "interests_depth" ON "interests" USING btree ("depth");--> statement-breakpoint
CREATE INDEX "interests_parent_index" ON "interests" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "post2interest_interest_index" ON "post2interest" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "post2interest_post_index" ON "post2interest" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_comments_parent_id_idx" ON "post_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "post_comments_user_id_idx" ON "post_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "post_media_post_id_idx" ON "post_media" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_posts_ai_checked" ON "posts" USING btree ("ai_checked");--> statement-breakpoint
CREATE INDEX "idx_posts_connector_id" ON "posts" USING btree ("connector_id");--> statement-breakpoint
CREATE INDEX "idx_posts_is_deleted" ON "posts" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_posts_publishing_date" ON "posts" USING btree ("publishing_date");--> statement-breakpoint
CREATE INDEX "idx_posts_source_key" ON "posts" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "idx_posts_title" ON "posts" USING btree ("title");--> statement-breakpoint
CREATE INDEX "idx_posts_topic" ON "posts" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "userInterest_interestId_idx" ON "userInterests" USING btree ("interest_id");--> statement-breakpoint
CREATE INDEX "userInterest_userId_idx" ON "userInterests" USING btree ("user_id");