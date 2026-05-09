import type { CollectorResult, SocialAuthor, SocialCollector, SocialNotification, SocialPost } from '../types/domain.js';
import type { MastodonConfig } from '../config/schema.js';

interface MastodonAccount {
  readonly id: string;
  readonly username: string;
  readonly acct: string;
  readonly display_name: string;
  readonly url: string;
}

interface MastodonStatus {
  readonly id: string;
  readonly created_at: string;
  readonly content: string;
  readonly url?: string | null;
  readonly account: MastodonAccount;
  readonly favourites_count: number;
  readonly replies_count: number;
  readonly reblogs_count: number;
  readonly mentions: readonly { readonly acct: string }[];
}

interface MastodonNotification {
  readonly id: string;
  readonly type: string;
  readonly created_at: string;
  readonly account: MastodonAccount;
  readonly status?: MastodonStatus;
}

interface MastodonList {
  readonly id: string;
  readonly title: string;
}

/**
 * Mastodon collector based on the official REST API.
 */
export class MastodonCollector implements SocialCollector {
  readonly #config: MastodonConfig;

  public constructor(config: MastodonConfig) {
    this.#config = config;
  }

  /**
   * Collects Mastodon home timeline, configured list timelines, and notifications.
   *
   * @param since - Lower date boundary.
   * @param limit - Maximum number of timeline items to request per source.
   * @returns Normalised collector result.
   */
  public async collect(since: Date, limit: number): Promise<CollectorResult> {
    const homeStatuses = await this.#getJson<readonly MastodonStatus[]>(
      `/api/v1/timelines/home?limit=${encodeURIComponent(String(limit))}`
    );

    const listStatuses = await this.#collectLists(limit);
    const notifications = await this.#getJson<readonly MastodonNotification[]>(
      `/api/v1/notifications?limit=${encodeURIComponent(String(limit))}`
    );

    const posts = [
      ...homeStatuses.map((status) => this.#normaliseStatus(status, 'timeline')),
      ...listStatuses.map((status) => this.#normaliseStatus(status, 'list')),
      ...notifications.flatMap((notification) => {
        if (notification.status === undefined) {
          return [];
        }

        return [this.#normaliseStatus(notification.status, 'notification')];
      })
    ].filter((post) => new Date(post.createdAt) >= since);

    return {
      posts: dedupePosts(posts),
      notifications: notifications
        .map((notification) => this.#normaliseNotification(notification))
        .filter((notification) => new Date(notification.createdAt) >= since)
    };
  }

  async #collectLists(limit: number): Promise<readonly MastodonStatus[]> {
    if (this.#config.lists.length === 0) {
      return [];
    }

    const lists = await this.#getJson<readonly MastodonList[]>('/api/v1/lists');
    const configuredTitles = new Set(this.#config.lists.map((title) => title.toLowerCase()));
    const selectedLists = lists.filter((list) => configuredTitles.has(list.title.toLowerCase()));
    const statuses: MastodonStatus[] = [];

    for (const list of selectedLists) {
      const listStatuses = await this.#getJson<readonly MastodonStatus[]>(
        `/api/v1/timelines/list/${encodeURIComponent(list.id)}?limit=${encodeURIComponent(String(limit))}`
      );
      statuses.push(...listStatuses);
    }

    return statuses;
  }

  async #getJson<T>(path: string): Promise<T> {
    const url = new URL(path, this.#config.instance);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.#config.accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mastodon API failed: ${response.status} ${response.statusText} ${body}`);
    }

    return response.json() as Promise<T>;
  }

  #normaliseStatus(status: MastodonStatus, source: SocialPost['source']): SocialPost {
    const text = stripHtml(status.content);

    return {
      id: status.id,
      network: 'mastodon',
      author: normaliseAccount(status.account),
      text,
      url: status.url ?? undefined,
      createdAt: status.created_at,
      favourites: status.favourites_count,
      replies: status.replies_count,
      reposts: status.reblogs_count,
      mentionsMe: false,
      source
    };
  }

  #normaliseNotification(notification: MastodonNotification): SocialNotification {
    return {
      id: notification.id,
      network: 'mastodon',
      type: notification.type,
      author: normaliseAccount(notification.account),
      post: notification.status === undefined ? undefined : this.#normaliseStatus(notification.status, 'notification'),
      createdAt: notification.created_at
    };
  }
}

function normaliseAccount(account: MastodonAccount): SocialAuthor {
  return {
    id: account.id,
    handle: account.acct,
    displayName: account.display_name.length > 0 ? account.display_name : account.username,
    url: account.url
  };
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .trim();
}

function dedupePosts(posts: readonly SocialPost[]): readonly SocialPost[] {
  const seen = new Set<string>();
  const deduped: SocialPost[] = [];

  for (const post of posts) {
    const key = `${post.network}:${post.id}`;

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(post);
    }
  }

  return deduped;
}
