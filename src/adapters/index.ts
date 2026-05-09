import type { AppConfig } from '../config/schema.js';
import type { NetworkName, SocialCollector } from '../types/domain.js';
import { BlueskyCollector } from './bluesky.js';
import { MastodonCollector } from './mastodon.js';

/**
 * Creates collectors for the selected networks.
 *
 * @param config - Application configuration.
 * @param requestedNetworks - Networks requested by the CLI.
 * @returns Collector map entries.
 */
export function createCollectors(
  config: AppConfig,
  requestedNetworks: readonly NetworkName[]
): readonly [NetworkName, SocialCollector][] {
  const collectors: [NetworkName, SocialCollector][] = [];

  if (requestedNetworks.includes('mastodon') && config.networks.mastodon?.enabled === true) {
    collectors.push(['mastodon', new MastodonCollector(config.networks.mastodon)]);
  }

  if (requestedNetworks.includes('bluesky') && config.networks.bluesky?.enabled === true) {
    collectors.push(['bluesky', new BlueskyCollector(config.networks.bluesky)]);
  }

  return collectors;
}
