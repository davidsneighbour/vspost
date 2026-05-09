import type { AppConfig } from '../config/schema.js';
import type { ScoredPost, SocialPost } from '../types/domain.js';

/**
 * Scores posts for relevance to David's Neighbour's social graph report.
 *
 * @param posts - Normalised posts from collectors.
 * @param config - Application configuration.
 * @returns Posts with score and score reasons, highest score first.
 */
export function scorePosts(posts: readonly SocialPost[], config: AppConfig): readonly ScoredPost[] {
  return posts
    .map((post) => scorePost(post, config))
    .sort((left, right) => right.score - left.score);
}

function scorePost(post: SocialPost, config: AppConfig): ScoredPost {
  let score = 0;
  const reasons: string[] = [];
  const haystack = `${post.text} ${post.author.handle} ${post.author.displayName}`.toLowerCase();

  const positiveMatches = config.topics.positive.filter((topic) => haystack.includes(topic.toLowerCase()));
  const negativeMatches = config.topics.negative.filter((topic) => haystack.includes(topic.toLowerCase()));

  if (positiveMatches.length > 0) {
    score += positiveMatches.length * 3;
    reasons.push(`topic match: ${positiveMatches.join(', ')}`);
  }

  if (negativeMatches.length > 0) {
    score -= negativeMatches.length * 5;
    reasons.push(`negative topic: ${negativeMatches.join(', ')}`);
  }

  if (post.mentionsMe) {
    score += 8;
    reasons.push('mentions you');
  }

  if (post.source === 'notification') {
    score += 4;
    reasons.push('from notifications');
  }

  const engagement = post.favourites + post.reposts * 2 + post.replies * 3;

  if (engagement > 0) {
    const engagementScore = Math.min(10, Math.round(Math.log10(engagement + 1) * 4));
    score += engagementScore;
    reasons.push(`engagement score: ${engagementScore}`);
  }

  if (hasUrl(post.text)) {
    score += 1;
    reasons.push('contains link');
  }

  if (post.text.length < 20) {
    score -= 2;
    reasons.push('very short post');
  }

  return {
    ...post,
    score,
    scoreReasons: reasons
  };
}

function hasUrl(value: string): boolean {
  return /https?:\/\//iu.test(value);
}
