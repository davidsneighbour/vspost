#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createCollectors } from './adapters/index.js';
import { loadConfig } from './config/load.js';
import { SocialReportDatabase } from './db/database.js';
import { writeMarkdownReport } from './report/markdown.js';
import { scorePosts } from './scoring/score.js';
import type { NetworkName, SocialNotification, SocialPost } from './types/domain.js';
import { formatError } from './utils/errors.js';

interface CliOptions {
  readonly command: 'run' | 'help';
  readonly configPath: string;
  readonly networks: readonly NetworkName[];
  readonly sinceHours: number | undefined;
}

/**
 * CLI entrypoint.
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.command === 'help') {
    printHelp();
    return;
  }

  const config = await loadConfig(options.configPath);
  const sinceHours = options.sinceHours ?? config.sinceHours;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const collectors = createCollectors(config, options.networks);

  if (collectors.length === 0) {
    throw new Error('No enabled collectors matched the requested networks. Check config and --network values.');
  }

  await mkdir(dirname(config.databasePath), { recursive: true });

  const database = new SocialReportDatabase(config.databasePath);
  const allPosts: SocialPost[] = [];
  const allNotifications: SocialNotification[] = [];

  try {
    for (const [network, collector] of collectors) {
      console.log(`Collecting ${network}...`);
      const result = await collector.collect(since, config.maxItemsPerNetwork);
      database.savePosts(result.posts);
      database.saveNotifications(result.notifications);
      allPosts.push(...result.posts);
      allNotifications.push(...result.notifications);
    }
  } finally {
    database.close();
  }

  const scoredPosts = scorePosts(allPosts, config);
  const outputPath = await writeMarkdownReport({
    outputDirectory: config.outputDirectory,
    since,
    generatedAt: new Date(),
    posts: scoredPosts,
    notifications: allNotifications
  });

  console.log(`Report written: ${outputPath}`);
}

function parseArgs(args: readonly string[]): CliOptions {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return {
      command: 'help',
      configPath: 'config.json',
      networks: ['mastodon', 'bluesky'],
      sinceHours: undefined
    };
  }

  const [command] = args;

  if (command !== 'run') {
    throw new Error(`Unknown command: ${command ?? '<none>'}`);
  }

  let configPath = 'config.json';
  let networks: readonly NetworkName[] = ['mastodon', 'bluesky'];
  let sinceHours: number | undefined;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case '--config': {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error('--config requires a value');
        }
        configPath = value;
        index += 1;
        break;
      }
      case '--network':
      case '--networks': {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error(`${arg} requires a comma-separated value`);
        }
        networks = parseNetworks(value);
        index += 1;
        break;
      }
      case '--all': {
        networks = ['mastodon', 'bluesky'];
        break;
      }
      case '--since-hours': {
        const value = args[index + 1];
        if (value === undefined) {
          throw new Error('--since-hours requires a numeric value');
        }
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error('--since-hours must be a positive integer');
        }
        sinceHours = parsed;
        index += 1;
        break;
      }
      default:
        throw new Error(`Unknown option: ${arg ?? '<none>'}`);
    }
  }

  return {
    command: 'run',
    configPath,
    networks,
    sinceHours
  };
}

function parseNetworks(value: string): readonly NetworkName[] {
  const parsed = value.split(',').map((item) => item.trim()).filter((item) => item.length > 0);
  const networks: NetworkName[] = [];

  for (const item of parsed) {
    if (item === 'mastodon' || item === 'bluesky') {
      networks.push(item);
    } else {
      throw new Error(`Unsupported network: ${item}`);
    }
  }

  if (networks.length === 0) {
    throw new Error('At least one network is required');
  }

  return networks;
}

function printHelp(): void {
  console.log(`Usage:
  dnb-social-report run [options]

Options:
  --config <path>             Path to config JSON. Default: config.json
  --network <names>           Comma-separated networks: mastodon,bluesky
  --networks <names>          Alias for --network
  --all                       Use all supported networks
  --since-hours <hours>       Lookback window. Default comes from config
  --help, -h                  Show this help

Examples:
  dnb-social-report run --config config.json --network mastodon --since-hours 24
  dnb-social-report run --config config.json --all
`);
}

main().catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
