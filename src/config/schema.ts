import { z } from 'zod';

const TopicsSchema = z.object({
  positive: z.array(z.string().min(1)).default([]),
  negative: z.array(z.string().min(1)).default([])
});

const MastodonConfigSchema = z.object({
  enabled: z.boolean().default(false),
  instance: z.string().url(),
  accessToken: z.string().min(1),
  lists: z.array(z.string()).default([])
});

const BlueskyConfigSchema = z.object({
  enabled: z.boolean().default(false),
  service: z.string().url().default('https://bsky.social'),
  identifier: z.string().min(1),
  appPassword: z.string().min(1)
});

export const AppConfigSchema = z.object({
  databasePath: z.string().min(1).default('./social-report.sqlite'),
  outputDirectory: z.string().min(1).default('./reports'),
  sinceHours: z.number().int().positive().default(24),
  maxItemsPerNetwork: z.number().int().positive().max(500).default(100),
  topics: TopicsSchema.default({ positive: [], negative: [] }),
  networks: z.object({
    mastodon: MastodonConfigSchema.optional(),
    bluesky: BlueskyConfigSchema.optional()
  })
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type MastodonConfig = z.infer<typeof MastodonConfigSchema>;
export type BlueskyConfig = z.infer<typeof BlueskyConfigSchema>;
