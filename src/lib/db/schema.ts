import { sqliteTable, text, integer, blob, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  bio: text('bio'),
  status: text('status', { enum: ['online', 'away', 'dnd', 'offline'] }).default('offline').notNull(),
  role: text('role', { enum: ['admin', 'member'] }).default('member').notNull(),
  isBanned: integer('is_banned').default(0).notNull(),
  customStatus: text('custom_status'),
  customStatusEmoji: text('custom_status_emoji'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const servers = sqliteTable('servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  isMain: integer('is_main').default(0).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const serverMembers = sqliteTable('server_members', {
  serverId: text('server_id').notNull().references(() => servers.id),
  userId: text('user_id').notNull().references(() => users.id),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).default('member').notNull(),
  joinedAt: integer('joined_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.serverId, table.userId] }),
}));

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  name: text('name').notNull(),
  type: text('type', { enum: ['text', 'voice', 'media'] }).default('text').notNull(),
  position: integer('position').default(0).notNull(),
  gradient: text('gradient'),
  imageUrl: text('image_url'),
  isPrivate: integer('is_private').default(0).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const channelMembers = sqliteTable('channel_members', {
  channelId: text('channel_id').notNull().references(() => channels.id),
  userId: text('user_id').notNull().references(() => users.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.channelId, table.userId] }),
}));

export const dmChannels = sqliteTable('dm_channels', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id').notNull().references(() => users.id),
  user2Id: text('user2_id').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  uniqueDm: uniqueIndex('unique_dm').on(table.user1Id, table.user2Id),
}));

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').references(() => channels.id),
  dmChannelId: text('dm_channel_id').references(() => dmChannels.id),
  groupDmId: text('group_dm_id'),
  authorId: text('author_id').notNull().references(() => users.id),
  encryptedContent: blob('encrypted_content', { mode: 'buffer' }).notNull(),
  replyToId: text('reply_to_id'),
  attachmentUrl: text('attachment_url'),
  attachmentType: text('attachment_type'),
  attachmentName: text('attachment_name'),
  linkPreview: text('link_preview'),
  editedAt: integer('edited_at'),
  createdAt: integer('created_at').notNull(),
});

export const reactions = sqliteTable('reactions', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id),
  userId: text('user_id').notNull().references(() => users.id),
  emoji: text('emoji').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const inviteCodes = sqliteTable('invite_codes', {
  code: text('code').primaryKey(),
  createdBy: text('created_by').notNull().references(() => users.id),
  usedBy: text('used_by').references(() => users.id),
  usedAt: integer('used_at'),
  revoked: integer('revoked').default(0).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const serverInvites = sqliteTable('server_invites', {
  code: text('code').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  createdBy: text('created_by').notNull().references(() => users.id),
  maxUses: integer('max_uses'),
  uses: integer('uses').default(0).notNull(),
  expiresAt: integer('expires_at'),
  revoked: integer('revoked').default(0).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const stories = sqliteTable('stories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  mediaUrl: text('media_url').notNull(),
  mediaType: text('media_type').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const storyViews = sqliteTable('story_views', {
  storyId: text('story_id').notNull().references(() => stories.id),
  userId: text('user_id').notNull().references(() => users.id),
  viewedAt: integer('viewed_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.storyId, table.userId] }),
}));

export const clips = sqliteTable('clips', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  authorId: text('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  likes: integer('likes').default(0).notNull(),
  createdAt: integer('created_at').notNull(),
});

export const clipLikes = sqliteTable('clip_likes', {
  clipId: text('clip_id').notNull().references(() => clips.id),
  userId: text('user_id').notNull().references(() => users.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.clipId, table.userId] }),
}));

export const clipComments = sqliteTable('clip_comments', {
  id: text('id').primaryKey(),
  clipId: text('clip_id').notNull().references(() => clips.id),
  authorId: text('author_id').notNull().references(() => users.id),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  targetId: text('target_id'),
  details: text('details'),
  createdAt: integer('created_at').notNull(),
});

export const serverMutes = sqliteTable('server_mutes', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  userId: text('user_id').notNull().references(() => users.id),
  mutedBy: text('muted_by').notNull().references(() => users.id),
  reason: text('reason'),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const messageReports = sqliteTable('message_reports', {
  id: text('id').primaryKey(),
  messageId: text('message_id').notNull().references(() => messages.id),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  serverId: text('server_id').notNull().references(() => servers.id),
  reason: text('reason').notNull(),
  status: text('status', { enum: ['pending', 'resolved', 'dismissed'] }).default('pending').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const wordFilters = sqliteTable('word_filters', {
  id: text('id').primaryKey(),
  serverId: text('server_id').notNull().references(() => servers.id),
  word: text('word').notNull(),
  addedBy: text('added_by').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
});

export const friendships = sqliteTable('friendships', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  friendId: text('friend_id').notNull().references(() => users.id),
  status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).default('pending').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const groupDms = sqliteTable('group_dms', {
  id: text('id').primaryKey(),
  name: text('name'),
  iconUrl: text('icon_url'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: integer('created_at').notNull(),
});

export const groupDmMembers = sqliteTable('group_dm_members', {
  groupDmId: text('group_dm_id').notNull().references(() => groupDms.id),
  userId: text('user_id').notNull().references(() => users.id),
  joinedAt: integer('joined_at').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupDmId, table.userId] }),
}));