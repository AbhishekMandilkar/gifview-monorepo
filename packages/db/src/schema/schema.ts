import { pgTable, index, foreignKey, text, timestamp, boolean, integer, unique, varchar, uniqueIndex, jsonb, check, uuid, date, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { user } from "./auth"

export const country = pgEnum("country", ['gb', 'es', 'fr', 'ua'])
export const depthEnum = pgEnum("depth_enum", ['1', '2', '3'])
export const language = pgEnum("language", ['en', 'es', 'fr', 'ukr'])


export const posts = pgTable("posts", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	title: text(),
	description: text(),
	topic: text(),
	tags: text().array(),
	connectorId: uuid("connector_id").notNull(),
	sourceKey: text("source_key"),
	sourceLink: text("source_link"),
	language: language(),
	publishingDate: timestamp("publishing_date", { precision: 6, mode: 'string' }),
	aiChecked: timestamp("ai_checked", { precision: 6, mode: 'string' }),
	content: text(),
	isDeleted: boolean("is_deleted"),
	createdDate: timestamp("created_date", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_posts_ai_checked").on(table.aiChecked),
	index("idx_posts_connector_id").on(table.connectorId),
	index("idx_posts_is_deleted").on(table.isDeleted),
	index("idx_posts_publishing_date").on(table.publishingDate),
	index("idx_posts_source_key").on(table.sourceKey),
	index("idx_posts_title").on(table.title),
	index("idx_posts_topic").on(table.topic),
	foreignKey({
			columns: [table.connectorId],
			foreignColumns: [connectors.id],
			name: "posts_connector_id_fkey"
		}).onUpdate("cascade").onDelete("restrict"),
]);

export const connectors = pgTable("connectors", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	connectorType: text("connector_type"),
	tempoSecs: integer("tempo_secs"),
	fetchPeriodMinutes: integer("fetch_period_minutes"),
	language: language(),
	active: boolean().default(false),
});

export const boUserSessions = pgTable("bo_user_sessions", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	lastActive: timestamp("last_active", { withTimezone: true, mode: 'string' }).defaultNow(),
	token: varchar({ length: 255 }).notNull(),
	userId: uuid("user_id").notNull(),
}, (table) => [
	index("idx_bo_user_sessions_token").on(table.token),
	index("idx_bo_user_sessions_user_id").on(table.userId),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [backofficeUsers.id],
			name: "bo_user_sessions_user_id_fkey"
		}),
	unique("bo_user_sessions_token_key").on(table.token),
]);

export const interests = pgTable("interests", {
	id: text("id").primaryKey().notNull(),
	nameEn: text("name_en"),
	nameEs: text("name_es"),
	nameFr: text("name_fr"),
	nameUkr: text("name_ukr"),
	color: text(),
	active: boolean(),
	isDeleted: boolean("is_deleted").default(false),
	parentId: text("parent_id"),
	depth: text(),
}, (table) => [
	index("interests_depth").on(table.depth),
	index("interests_parent_index").on(table.parentId),
]);

export const post2Interest = pgTable("post2interest", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull(),
	interestId: text("interest_id"),
	isDeleted: boolean("is_deleted"),
}, (table) => [
	index("post2interest_interest_index").on(table.interestId),
	index("post2interest_post_index").on(table.postId),
	foreignKey({
			columns: [table.interestId],
			foreignColumns: [interests.id],
			name: "post2interest_interest_id_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const backofficeUsers = pgTable("backoffice_users", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	enabled: boolean().default(true).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
}, (table) => [
	uniqueIndex("backoffice_users_email_key").on(table.email),
]);



export const postMedia = pgTable("post_media", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull(),
	mediaType: text(),
	mediaUrl: text().notNull(),
	isDeleted: boolean("is_deleted"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	metadata: jsonb(),
}, (table) => [
	index("post_media_post_id_idx").on(table.postId),
]);

export const gifs = pgTable("gifs", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	url: text().notNull(),
	provider: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.postId],
			foreignColumns: [posts.id],
			name: "gifs_post_id_fkey"
		}).onUpdate("restrict").onDelete("set null"),
	unique("gifs_post_id_key").on(table.postId),
	unique("gifs_url_key").on(table.url),
]);

export const digitalDetoxSessions = pgTable("digital_detox_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	status: varchar().default('scheduled').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
}, (table) => [
	index("idx_digital_detox_sessions_dates").on(table.startDate, table.endDate),
	index("idx_digital_detox_sessions_status_deleted").on(table.status, table.isDeleted),
	check("digital_detox_sessions_end_date_check", sql`end_date >= start_date`),
]);

export const detoxEvents = pgTable("detox_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	name: text().notNull(),
	description: text(),
	link: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
}, (table) => [
	index("idx_detox_events_session_id_deleted").on(table.sessionId, table.isDeleted),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [digitalDetoxSessions.id],
			name: "detox_events_session_id_fkey"
		}).onDelete("cascade"),
]);

export const userInterests = pgTable("userInterests", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	interestId: text("interest_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
}, (table) => [
	index("userInterest_interestId_idx").on(table.interestId),
	index("userInterest_userId_idx").on(table.userId),
]);

export const postLikes = pgTable("post_likes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isDeleted: boolean("is_deleted").notNull(),
});

export const postComments = pgTable("post_comments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	postId: uuid("post_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	parentId: uuid("parent_id"),
	content: text(),
	isDeleted: boolean("is_deleted").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	gifUrl: text("gif_url"),
}, (table) => [
	index("post_comments_parent_id_idx").on(table.parentId),
	index("post_comments_user_id_idx").on(table.userId),
]);

export const interestRequests = pgTable("interest_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userEmail: varchar("user_email", { length: 255 }).notNull(),
	interest: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	accepted: boolean().default(false).notNull(),
	isDeleted: boolean("is_deleted").default(false).notNull(),
	message: text(),
}, (table) => [
	index("idx_interest_requests_accepted_created_at").on(table.accepted, table.createdAt),
	index("idx_interest_requests_interest").on(table.interest),
	index("idx_interest_requests_user_email").on(table.userEmail),
]);

export const commentLikes = pgTable("comment_likes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	commentId: uuid("comment_id").notNull(),
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	isDeleted: boolean("is_deleted").notNull(),
}, (table) => [
	index("comment_likes_user_id_idx").on(table.userId),
]);
