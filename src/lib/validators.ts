import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  password: z.string().min(8).max(128),
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const createServerSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  type: z.enum(['text', 'voice', 'media']).default('text'),
  gradient: z.string().max(200).optional(),
  isPrivate: z.boolean().default(false),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  gradient: z.string().max(200).nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  position: z.number().int().optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  replyToId: z.string().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const addReactionSchema = z.object({
  emoji: z.string().min(1).max(20),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  status: z.enum(['online', 'away', 'dnd', 'offline']).optional(),
});

export const createDmSchema = z.object({
  userId: z.string().uuid(),
});

export const joinServerInviteSchema = z.object({
  code: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateServerInput = z.infer<typeof createServerSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type AddReactionInput = z.infer<typeof addReactionSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateDmInput = z.infer<typeof createDmSchema>;
export type JoinServerInviteInput = z.infer<typeof joinServerInviteSchema>;