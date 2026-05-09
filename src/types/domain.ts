export type NetworkName = 'mastodon' | 'bluesky';

export interface SocialAuthor {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly url: string | undefined;
}

export interface SocialPost {
  readonly id: string;
  readonly network: NetworkName;
  readonly author: SocialAuthor;
  readonly text: string;
  readonly url: string | undefined;
  readonly createdAt: string;
  readonly favourites: number;
  readonly replies: number;
  readonly reposts: number;
  readonly mentionsMe: boolean;
  readonly source: 'timeline' | 'notification' | 'list';
}

export interface ScoredPost extends SocialPost {
  readonly score: number;
  readonly scoreReasons: readonly string[];
  readonly hasPositiveTopicMatch: boolean;
  readonly hasNegativeTopicMatch: boolean;
}

export interface SocialNotification {
  readonly id: string;
  readonly network: NetworkName;
  readonly type: string;
  readonly author: SocialAuthor;
  readonly post: SocialPost | undefined;
  readonly createdAt: string;
}

export interface CollectorResult {
  readonly posts: readonly SocialPost[];
  readonly notifications: readonly SocialNotification[];
}

export interface SocialCollector {
  collect(since: Date, limit: number): Promise<CollectorResult>;
}
