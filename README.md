# dnb-social-report

Prototype CLI for a personal social graph report across Mastodon and Bluesky.

It collects posts from your own graph, stores normalised snapshots in SQLite, scores posts against configured research topics, and writes timestamped Markdown reports for manual review.

## Current status

This is a read-only prototype. It helps decide what to read, reply to, bookmark, list, mute, or unfollow manually; it does not take social actions for you.

## Supported networks

- Mastodon
  - Home timeline
  - Configured list timelines
  - Notifications
- Bluesky
  - Home timeline
  - Notifications

## Documentation

- [Research reports: how to read and maintain them](research/index.md) is the topic-first entry point for understanding generated reports, scoring, daily review, and weekly tuning.
- [Mastodon reports](research/mastodon-reports.md) is the network-first entry point for reading `mastodon.md` and understanding how Mastodon data is collected.
- [Database schema for `social-report.sqlite`](research/database-schema.md) documents content types, tables, and relationships.

## Setup

```bash
npm install
cp config.example.json config.json
cp .env.example .env
```

Load your environment variables before running the tool. For example:

```bash
set -a
source .env
set +a
```

Edit `config.json` and set the topics, output path, and network settings.

## Mastodon access token

Create a Mastodon application in your account settings and give it read scopes. Then set:

```bash
MASTODON_HOST=https://your.instance
MASTODON_ACCESS_TOKEN=your-token
```

## Bluesky app password

Create an app password in Bluesky and set:

```bash
BLUESKY_HOST=https://bsky.social
BLUESKY_IDENTIFIER=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
```

## NPM scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm run build` | `tsc -p tsconfig.json` | Compile TypeScript into `dist/`. |
| `npm run start` | `node ./dist/cli.js` | Start the compiled CLI. Pass CLI arguments after `--`. |
| `npm run check` | `tsc -p tsconfig.json --noEmit` | Type-check without writing compiled output. |

There is currently no dedicated automated test script.

## Run

Build the CLI, then run a report:

```bash
npm run build
node ./dist/cli.js run --config config.json --all --since-hours 24
```

You can also use the `start` script after building:

```bash
npm run start -- run --config config.json --all --since-hours 24
```

Or after global installation:

```bash
dnb-social-report run --config config.json --all --since-hours 24
```

Useful run options:

```text
--config <path>        Path to config JSON. Default: config.json
--network <names>      Comma-separated networks: mastodon,bluesky
--networks <names>     Alias for --network
--all                  Use all supported networks
--since-hours <hours>  Lookback window. Default comes from config
--help, -h             Show CLI help
```

## Output

The default output is a timestamped report directory under `./reports/` and a SQLite database at `./social-report.sqlite`. Each report directory contains an `index.md` overview plus one Markdown file per enabled network, such as `mastodon.md` and `bluesky.md`.

The database stores normalised posts and notifications. Scores are calculated when reports are generated and are not currently stored in SQLite. See the [database schema documentation](research/database-schema.md) for details.

## Operating rhythm

### Daily

- Run a 24-hour report.
- Open the newest `reports/<timestamp>/index.md`.
- Review the top cross-network posts, then open each per-network report.
- Clear mentions and notifications manually in the original network UI.
- Save useful posts, reply where you can add specific value, and note repeated topic misses for later tuning.

See the expanded [daily workflow](research/index.md#daily-and-weekly-operating-rhythm).

### Weekly

- Compare several recent reports, especially noise-heavy and account-review sections.
- Tune `topics.positive` and `topics.negative` based on repeated patterns, not one-off posts.
- Confirm Mastodon list names in `config.json` still match the lists on your instance.
- Archive or back up `social-report.sqlite` and report directories if you want long-term history.
- Run `npm run check` before committing code or documentation changes.

See the expanded [weekly workflow](research/index.md#daily-and-weekly-operating-rhythm).

## Safety rule

This prototype does not follow, unfollow, mute, block, reply, repost, or send messages. It only reads and reports. All account and conversation actions should remain manual until the scoring is trusted and the project explicitly adds safe automation.
