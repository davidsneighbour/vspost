import { AtpAgent } from "@atproto/api";
import type { AppBskyFeedDefs, AppBskyNotificationListNotifications } from '@atproto/api';
import type { BlueskyConfig } from '../config/schema.js';
import type { CollectorResult, SocialAuthor, SocialCollector, SocialNotification, SocialPost } from '../types/domain.js';

/**
 * Bluesky collector using the official AT Protocol TypeScript client.
 */
export class BlueskyCollector implements SocialCollector {
  readonly #config: BlueskyConfig;

  public constructor(config: BlueskyConfig) {
    this.#config = config;
  }

  /**
   * Collects Bluesky home timeline and notifications.
   *
   * @param since - Lower date boundary.
   * @param limit - Maximum number of timeline items to request.
   * @returns Normalised collector result.
   */
  public async collect(since: Date, limit: number): Promise<CollectorResult> {
    const agent = new AtpAgent({ service: this.#config.service });

    await agent.login({
      identifier: this.#config.identifier,
      password: this.#config.appPassword
    });

    const timeline = await agent.getTimeline({ limit });
    const notifications = await agent.listNotifications({ limit });

    return {
      posts: timeline.data.feed
        .map((item) => normaliseFeedViewPost(item.post, 'timeline'))
        .filter((post) => new Date(post.createdAt) >= since),
      notifications: notifications.data.notifications
        .map((notification) => normaliseNotification(notification))
        .filter((notification) => new Date(notification.createdAt) >= since)
    };
  }
}

function normaliseNotification(
  notification: AppBskyNotificationListNotifications.Notification
): SocialNotification {
  const author = normaliseAuthor(notification.author);
  const post = notification.record !== undefined && notification.uri.length > 0
    ? normaliseNotificationPost(notification, author)
    : undefined;

  return {
    id: notification.uri,
    network: 'bluesky',
    type: notification.reason,
    author,
    post,
    createdAt: notification.indexedAt
  };
}

function normaliseNotificationPost(
  notification: AppBskyNotificationListNotifications.Notification,
  author: SocialAuthor
): SocialPost {
  const text = getRecordText(notification.record);

  return {
    id: notification.uri,
    network: 'bluesky',
    author,
    text,
    url: blueskyUriToUrl(notification.uri, author.handle),
    createdAt: notification.indexedAt,
    favourites: 0,
    replies: 0,
    reposts: 0,
    mentionsMe: true,
    source: 'notification'
  };
}

function normaliseFeedViewPost(
  post: AppBskyFeedDefs.PostView,
  source: SocialPost['source']
): SocialPost {
  const author = normaliseAuthor(post.author);

  return {
    id: post.uri,
    network: 'bluesky',
    author,
    text: getRecordText(post.record),
    url: blueskyUriToUrl(post.uri, author.handle),
    createdAt: post.indexedAt,
    favourites: post.likeCount ?? 0,
    replies: post.replyCount ?? 0,
    reposts: post.repostCount ?? 0,
    mentionsMe: false,
    source
  };
}

interface BlueskyAuthorLike {
  readonly did: string;
  readonly handle: string;
  readonly displayName?: string;
  readonly avatar?: string;
}


/**
 * Converts a Bluesky API author shape into the internal author model.
 *
 * @param author - Bluesky author object from timeline or notification payloads.
 * @returns Normalised internal social author.
 */
function normaliseAuthor(author: BlueskyAuthorLike): SocialAuthor {
  return {
    id: author.did,
    handle: author.handle,
    displayName: author.displayName ?? author.handle,
    //avatar: author.avatar,
    url: `https://bsky.app/profile/${author.handle}`,
  };
}

function getRecordText(record: unknown): string {
  if (record !== null && typeof record === 'object' && 'text' in record) {
    const value = (record as { readonly text?: unknown }).text;

    if (typeof value === 'string') {
      return value.trim();
    }
  }

  return '';
}

function blueskyUriToUrl(uri: string, handle: string): string | undefined {
  const parts = uri.split('/');
  const postId = parts.at(-1);

  if (postId === undefined || postId.length === 0) {
    return undefined;
  }

  return `https://bsky.app/profile/${handle}/post/${postId}`;
}
