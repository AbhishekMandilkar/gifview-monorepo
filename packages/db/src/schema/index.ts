export * from "./auth";
export * from "./schema";
export * from "./relations";

import { posts, gifs, connectors, interests, postMedia, postLikes, postComments, commentLikes, post2Interest } from "./schema";
import { user } from "./auth";

export type Post = typeof posts.$inferSelect;
export type PostInsert = typeof posts.$inferInsert;
export type Gif = typeof gifs.$inferSelect;
export type GifInsert = typeof gifs.$inferInsert;
export type User = typeof user.$inferSelect;
export type Connector = typeof connectors.$inferSelect;
export type ConnectorInsert = typeof connectors.$inferInsert;
export type Interest = typeof interests.$inferSelect;
export type InterestInsert = typeof interests.$inferInsert;
export type PostMedia = typeof postMedia.$inferSelect;
export type PostMediaInsert = typeof postMedia.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type PostLikeInsert = typeof postLikes.$inferInsert;
export type PostComment = typeof postComments.$inferSelect;
export type PostCommentInsert = typeof postComments.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;
export type CommentLikeInsert = typeof commentLikes.$inferInsert;
export type Post2Interest = typeof post2Interest.$inferSelect;
export type Post2InterestInsert = typeof post2Interest.$inferInsert;
