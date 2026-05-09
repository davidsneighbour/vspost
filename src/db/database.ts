import Database from 'better-sqlite3';
import type { SocialNotification, SocialPost } from '../types/domain.js';

/**
 * Thin SQLite repository for report snapshots.
 */
export class SocialReportDatabase {
  readonly #database: Database.Database;

  public constructor(databasePath: string) {
    this.#database = new Database(databasePath);
    this.#database.pragma('journal_mode = WAL');
    this.#migrate();
  }

  /**
   * Persists normalised posts.
   *
   * @param posts - Posts to store.
   */
  public savePosts(posts: readonly SocialPost[]): void {
    const statement = this.#database.prepare(`
      INSERT OR REPLACE INTO posts (
        id, network, author_id, author_handle, author_display_name, author_url,
        text, url, created_at, favourites, replies, reposts, mentions_me, source
      ) VALUES (
        @id, @network, @authorId, @authorHandle, @authorDisplayName, @authorUrl,
        @text, @url, @createdAt, @favourites, @replies, @reposts, @mentionsMe, @source
      )
    `);

    const transaction = this.#database.transaction((items: readonly SocialPost[]) => {
      for (const post of items) {
        statement.run({
          id: `${post.network}:${post.id}`,
          network: post.network,
          authorId: post.author.id,
          authorHandle: post.author.handle,
          authorDisplayName: post.author.displayName,
          authorUrl: post.author.url ?? null,
          text: post.text,
          url: post.url ?? null,
          createdAt: post.createdAt,
          favourites: post.favourites,
          replies: post.replies,
          reposts: post.reposts,
          mentionsMe: post.mentionsMe ? 1 : 0,
          source: post.source
        });
      }
    });

    transaction(posts);
  }

  /**
   * Persists normalised notifications.
   *
   * @param notifications - Notifications to store.
   */
  public saveNotifications(notifications: readonly SocialNotification[]): void {
    const statement = this.#database.prepare(`
      INSERT OR REPLACE INTO notifications (
        id, network, type, author_id, author_handle, author_display_name, created_at, post_id
      ) VALUES (
        @id, @network, @type, @authorId, @authorHandle, @authorDisplayName, @createdAt, @postId
      )
    `);

    const transaction = this.#database.transaction((items: readonly SocialNotification[]) => {
      for (const notification of items) {
        statement.run({
          id: `${notification.network}:${notification.id}`,
          network: notification.network,
          type: notification.type,
          authorId: notification.author.id,
          authorHandle: notification.author.handle,
          authorDisplayName: notification.author.displayName,
          createdAt: notification.createdAt,
          postId: notification.post === undefined ? null : `${notification.post.network}:${notification.post.id}`
        });
      }
    });

    transaction(notifications);
  }

  /**
   * Closes the SQLite database handle.
   */
  public close(): void {
    this.#database.close();
  }

  #migrate(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        network TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_handle TEXT NOT NULL,
        author_display_name TEXT NOT NULL,
        author_url TEXT,
        text TEXT NOT NULL,
        url TEXT,
        created_at TEXT NOT NULL,
        favourites INTEGER NOT NULL,
        replies INTEGER NOT NULL,
        reposts INTEGER NOT NULL,
        mentions_me INTEGER NOT NULL,
        source TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        network TEXT NOT NULL,
        type TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_handle TEXT NOT NULL,
        author_display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        post_id TEXT
      );
    `);
  }
}
