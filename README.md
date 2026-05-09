# dnb-social-report

Prototype CLI for a personal social graph report across Mastodon and Bluesky.

It collects posts from your own graph, stores snapshots in SQLite, scores posts against David's Neighbour topics, and writes a Markdown report.

## Supported networks

* Mastodon
  * Home timeline
  * Configured list timelines
  * Notifications
* Bluesky
  * Home timeline
  * Notifications

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

## Run

```bash
npm run build
node ./dist/cli.js run --config config.json --all --since-hours 24
```

Or after global installation:

```bash
dnb-social-report run --config config.json --all --since-hours 24
```

## Output

The default output is a timestamped report directory under `./reports/` and a SQLite database at `./social-report.sqlite`. Each report directory contains an `index.md` overview plus one Markdown file per enabled network, such as `mastodon.md` and `bluesky.md`.

## Safety rule

This prototype does not follow, unfollow, mute, block, reply, or send messages. It only reads and reports.
