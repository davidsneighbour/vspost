import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NetworkName, ScoredPost, SocialNotification } from '../types/domain.js';
import { groupBy } from '../utils/collections.js';

export interface MarkdownReportInput {
  readonly outputDirectory: string;
  readonly since: Date;
  readonly generatedAt: Date;
  readonly networks: readonly NetworkName[];
  readonly posts: readonly ScoredPost[];
  readonly notifications: readonly SocialNotification[];
}

interface NetworkReportSummary {
  readonly network: NetworkName;
  readonly postCount: number;
  readonly notificationCount: number;
  readonly reportFile: string;
}

interface NetworkReportInput {
  readonly generatedAt: Date;
  readonly since: Date;
  readonly network: NetworkName;
  readonly posts: readonly ScoredPost[];
  readonly notifications: readonly SocialNotification[];
}

/**
 * Writes Markdown social graph reports into a timestamped report directory.
 *
 * @param input - Report data and output settings.
 * @returns Path to the created report directory.
 */
export async function writeMarkdownReport(input: MarkdownReportInput): Promise<string> {
  const reportDirectory = join(input.outputDirectory, toDateSlug(input.generatedAt));
  await mkdir(reportDirectory, { recursive: true });

  const postsByNetwork = groupBy(input.posts, (post) => post.network);
  const notificationsByNetwork = groupBy(input.notifications, (notification) => notification.network);
  const summaries: NetworkReportSummary[] = [];

  for (const network of input.networks) {
    const posts = postsByNetwork.get(network) ?? [];
    const notifications = notificationsByNetwork.get(network) ?? [];
    const reportFile = `${network}.md`;
    const markdown = renderNetworkReport({
      generatedAt: input.generatedAt,
      since: input.since,
      network,
      posts,
      notifications
    });

    await writeFile(join(reportDirectory, reportFile), markdown, 'utf8');

    summaries.push({
      network,
      postCount: posts.length,
      notificationCount: notifications.length,
      reportFile
    });
  }

  const indexMarkdown = renderIndexReport({
    generatedAt: input.generatedAt,
    since: input.since,
    networks: summaries,
    topPosts: input.posts.filter((post) => post.hasPositiveTopicMatch && post.score > 0).slice(0, 5)
  });

  await writeFile(join(reportDirectory, 'index.md'), indexMarkdown, 'utf8');

  return reportDirectory;
}

function renderIndexReport(input: {
  readonly generatedAt: Date;
  readonly since: Date;
  readonly networks: readonly NetworkReportSummary[];
  readonly topPosts: readonly ScoredPost[];
}): string {
  return [
    '# Social graph report',
    '',
    `Generated: ${input.generatedAt.toISOString()}`,
    `Window start: ${input.since.toISOString()}`,
    '',
    '## Network reports',
    '',
    renderNetworkSummaryTable(input.networks),
    '',
    '## Top 5 cross-network technical posts',
    '',
    renderPostList(input.topPosts),
    '',
    '## Manual next actions',
    '',
    '* Open the per-network reports for Mastodon-only and Bluesky-only review queues.',
    '* Reply to posts where you can add specific technical value.',
    '* Move useful accounts into topic lists.',
    '* Keep all follow/unfollow actions manual until the scoring is trusted.',
    ''
  ].join('\n');
}

function renderNetworkReport(input: NetworkReportInput): string {
  const technicalPosts = input.posts
    .filter((post) => post.hasPositiveTopicMatch && post.score > 0)
    .slice(0, 25);
  const highEngagementOffTopicPosts = input.posts
    .filter((post) => !post.hasPositiveTopicMatch && post.score > 0 && hasEngagementScore(post))
    .slice(0, 15);
  const noiseHeavyPosts = input.posts
    .filter((post) => post.hasNegativeTopicMatch && !post.hasPositiveTopicMatch)
    .slice(0, 15);
  const reviewPosts = input.posts
    .filter((post) => post.score <= 0 && !noiseHeavyPosts.some((noisePost) => noisePost.id === post.id))
    .slice(0, 15);
  const notifications = input.notifications.slice(0, 25);

  return [
    `# ${capitalise(input.network)} social graph report`,
    '',
    `Generated: ${input.generatedAt.toISOString()}`,
    `Window start: ${input.since.toISOString()}`,
    `Network: ${input.network}`,
    '',
    '## Most relevant technical posts',
    '',
    renderPostList(technicalPosts),
    '',
    '## High-engagement but off-topic posts',
    '',
    renderPostList(highEngagementOffTopicPosts),
    '',
    '## Political/noise-heavy posts to review',
    '',
    renderPostList(noiseHeavyPosts),
    '',
    '## Mentions and notifications',
    '',
    renderNotificationList(notifications),
    '',
    '## Account review suggestions',
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

function renderNetworkSummaryTable(networks: readonly NetworkReportSummary[]): string {
  if (networks.length === 0) {
    return '_No network reports were generated._';
  }

  return [
    '| Network | Posts | Notifications | Report |',
    '| --- | ---: | ---: | --- |',
    ...networks.map((network) => `| ${network.network} | ${network.postCount} | ${network.notificationCount} | [${network.reportFile}](${network.reportFile}) |`)
  ].join('\n');
}

function renderPostList(posts: readonly ScoredPost[]): string {
  if (posts.length === 0) {
    return '_No posts found._';
  }

  return posts
    .map((post) => {
      const title = post.url === undefined
        ? `**${escapeMarkdown(post.author.displayName)}** (${post.network})`
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

function hasEngagementScore(post: ScoredPost): boolean {
  return post.scoreReasons.some((reason) => reason.startsWith('engagement score:'));
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

function capitalise(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function toDateSlug(date: Date): string {
  return date.toISOString().replace(/[:.]/gu, '-');
}
