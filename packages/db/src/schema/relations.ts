import { relations } from "drizzle-orm/relations";
import { connectors, posts, backofficeUsers, boUserSessions, interests, post2Interest, gifs, digitalDetoxSessions, detoxEvents } from "./schema";

export const postsRelations = relations(posts, ({one, many}) => ({
	connector: one(connectors, {
		fields: [posts.connectorId],
		references: [connectors.id]
	}),
	gifs: many(gifs),
}));

export const connectorsRelations = relations(connectors, ({many}) => ({
	posts: many(posts),
}));

export const boUserSessionsRelations = relations(boUserSessions, ({one}) => ({
	backofficeUser: one(backofficeUsers, {
		fields: [boUserSessions.userId],
		references: [backofficeUsers.id]
	}),
}));

export const backofficeUsersRelations = relations(backofficeUsers, ({many}) => ({
	boUserSessions: many(boUserSessions),
}));

export const post2InterestRelations = relations(post2Interest, ({one}) => ({
	interest: one(interests, {
		fields: [post2Interest.interestId],
		references: [interests.id]
	}),
}));

export const interestsRelations = relations(interests, ({many}) => ({
	post2Interests: many(post2Interest),
}));

export const gifsRelations = relations(gifs, ({one}) => ({
	post: one(posts, {
		fields: [gifs.postId],
		references: [posts.id]
	}),
}));

export const detoxEventsRelations = relations(detoxEvents, ({one}) => ({
	digitalDetoxSession: one(digitalDetoxSessions, {
		fields: [detoxEvents.sessionId],
		references: [digitalDetoxSessions.id]
	}),
}));

export const digitalDetoxSessionsRelations = relations(digitalDetoxSessions, ({many}) => ({
	detoxEvents: many(detoxEvents),
}));