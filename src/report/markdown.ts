import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScoredPost, SocialNotification } from '../types/domain.js';

export interface MarkdownReportInput {
  readonly outputDirectory: string;
  readonly since: Date;
  readonly generatedAt: Date;
  readonly posts: readonly ScoredPost[];
  readonly notifications: readonly SocialNotification[];
}

/**
 * Writes a Markdown social graph report.
 *
 * @param input - Report data and output settings.
 * @returns Path to the created report file.
 */
export async function writeMarkdownReport(input: MarkdownReportInput): Promise<string> {
  await mkdir(input.outputDirectory, { recursive: true });

  const filename = `social-report-${toDateSlug(input.generatedAt)}.md`;
  const outputPath = join(input.outputDirectory, filename);
  const markdown = renderMarkdownReport(input);

  await writeFile(outputPath, markdown, 'utf8');

  return outputPath;
}

function renderMarkdownReport(input: MarkdownReportInput): string {
  const topPosts = input.posts.filter((post) => post.score > 0).slice(0, 25);
  const reviewPosts = input.posts.filter((post) => post.score <= 0).slice(0, 15);
  const notifications = input.notifications.slice(0, 25);

  return [
    '# Social graph report',
    '',
    `Generated: ${input.generatedAt.toISOString()}`,
    `Window start: ${input.since.toISOString()}`,
    '',
    '## Most relevant posts',
    '',
    renderPostList(topPosts),
    '',
    '## Mentions and notifications',
    '',
    renderNotificationList(notifications),
    '',
    '## Accounts/posts to review',
    '',
    renderPostList(reviewPosts),
    '',
    '## Manual next actions',
    '',
    '* Reply to posts where you can add specific technical value.',
    '* Move useful accounts into topic lists.',
    '* Unfollow or mute accounts that repeatedly score low for relevance.',
    '* Keep all follow/unfollow actions manual until the scoring is trusted.',
    ''
  ].join('\n');
}

function renderPostList(posts: readonly ScoredPost[]): string {
  if (posts.length === 0) {
    return '_No posts found._';
  }

  return posts
    .map((post) => {
      const title = post.url === undefined
        ? `**${post.author.displayName}** (${post.network})`
        : `**[${escapeMarkdown(post.author.displayName)}](${post.url})** (${post.network})`;
      const text = quoteMarkdown(post.text.length > 700 ? `${post.text.slice(0, 697)}...` : post.text);
      const reasons = post.scoreReasons.length === 0 ? 'none' : post.scoreReasons.join('; ');

      return [
        `### ${title}`,
        '',
        `Score: ${post.score} | Source: ${post.source} | Created: ${post.createdAt}`,
        '',
        text,
        '',
        `Reasons: ${reasons}`
      ].join('\n');
    })
    .join('\n\n');
}

function renderNotificationList(notifications: readonly SocialNotification[]): string {
  if (notifications.length === 0) {
    return '_No notifications found._';
  }

  return notifications
    .map((notification) => {
      const postUrl = notification.post?.url;
      const postPart = postUrl === undefined ? '' : ` - [post](${postUrl})`;

      return `* ${notification.createdAt}: ${notification.type} from **${escapeMarkdown(notification.author.displayName)}** (${notification.network})${postPart}`;
    })
    .join('\n');
}

function quoteMarkdown(value: string): string {
  return value
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\[\]()`*_{}]/gu, '\\$&');
}

function toDateSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, '-');
}
