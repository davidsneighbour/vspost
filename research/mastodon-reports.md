# Mastodon reports

This file is the network entry point for Mastodon. Start here when you are looking at a generated `mastodon.md`, changing Mastodon collection, or debugging why a Mastodon post did or did not appear in a report.

For the topic-first reading path, start with [Research reports: how to read and maintain them](index.md). The two documents share concepts: the Mastodon collector only decides what data enters the common pipeline; scoring, storage, and rendering are shared with other networks.

## What `mastodon.md` is for

`mastodon.md` is a per-network triage report for Mastodon content inside the configured lookback window. It answers four practical questions:

1. Which Mastodon posts are most relevant to the configured technical topics?
2. Which off-topic posts were loud enough to notice?
3. Which noise-heavy posts or accounts should be reviewed later?
4. Which Mastodon notifications need a human response?

It is not a comprehensive Mastodon archive. It is a prioritised view assembled from the API endpoints the collector currently reads.

## How to read a Mastodon report

A Mastodon report has the same sections as other network reports, but the source labels are especially useful because Mastodon collects from more than one timeline source.

### Header

The header contains:

- `Generated`: when the Markdown file was written.
- `Window start`: the lower bound used to filter collected posts and notifications.
- `Network: mastodon`: the normalised network name used in report output and database rows.

When debugging a missing post, compare the post's Mastodon `created_at` timestamp with `Window start`. Posts older than the window are intentionally filtered out even if the API returned them.

### Most relevant technical posts

These are Mastodon posts with at least one positive topic match and a score above zero. Review this section first during daily research. The strongest candidates usually combine a topic match with a list source, notification source, link, or engagement.

### High-engagement but off-topic posts

These are Mastodon posts without positive topic matches that still scored above zero because of engagement. Use them as a feed-temperature check. If the same off-topic theme appears here often, tune negative topics or adjust who appears in your home timeline and lists.

### Political/noise-heavy posts to review

These posts matched negative topics without positive topics. The scorer caps this case at zero so it does not become a "top" post even if it has engagement. Review this section weekly, not impulsively.

### Mentions and notifications

This section renders Mastodon notifications returned by `/api/v1/notifications`. Notification rows may include a link to the related status when the notification payload contains one. Treat this as the first place to check for replies or direct social obligations.

### Account review suggestions

This is a low-scoring queue, not a decision engine. If a Mastodon account repeatedly appears here across multiple reports and never appears in the relevant section, review it manually in Mastodon's UI.

## Mastodon sources and what they mean

Mastodon posts can enter the common `SocialPost` model with one of three sources.

| Source | How it is collected | How to interpret it |
| --- | --- | --- |
| `timeline` | From `/api/v1/timelines/home`. | Content from the home timeline. It reflects follows, boosts, and instance behaviour. |
| `list` | From `/api/v1/timelines/list/:id` for configured list names. | Content from curated Mastodon lists. It is often more intentional than the home timeline. |
| `notification` | From the `status` embedded in `/api/v1/notifications`. | Content attached to an interaction. It may deserve fast human review even with a modest topic score. |

The collector de-duplicates posts after combining those sources. If the same status appears in the home timeline and a list, only one normalised post is kept for that collection result.

## How Mastodon reports are built

### 1. Configuration gates collection

Mastodon collection runs only when both conditions are true:

- the CLI requested Mastodon, either with `--all` or `--network mastodon`; and
- `networks.mastodon.enabled` is `true` in `config.json`.

The Mastodon config also needs:

- `instance`: the base URL of the Mastodon instance, often supplied from `MASTODON_HOST`;
- `accessToken`: a read-capable access token, often supplied from `MASTODON_ACCESS_TOKEN`;
- `lists`: an array of Mastodon list titles to include in addition to the home timeline.

List matching is case-insensitive by title. If a configured list title does not exactly match an existing Mastodon list title after lower-casing, that list contributes no posts.

### 2. The collector calls Mastodon endpoints

For each run, the collector requests:

1. Home timeline: `/api/v1/timelines/home?limit=<maxItemsPerNetwork>`
2. Lists index, only when `lists` is not empty: `/api/v1/lists`
3. One list timeline per matched list: `/api/v1/timelines/list/<list-id>?limit=<maxItemsPerNetwork>`
4. Notifications: `/api/v1/notifications?limit=<maxItemsPerNetwork>`

The tool uses the configured access token as a bearer token and asks for JSON responses.

### 3. Mastodon statuses are normalised

A Mastodon status becomes a common post with these mappings:

| Common field | Mastodon source |
| --- | --- |
| `id` | `status.id` |
| `network` | literal `mastodon` |
| `author.id` | `status.account.id` |
| `author.handle` | `status.account.acct` |
| `author.displayName` | `status.account.display_name`, falling back to `username` |
| `author.url` | `status.account.url` |
| `text` | `status.content` after simple HTML stripping and entity decoding |
| `url` | `status.url` when present |
| `createdAt` | `status.created_at` |
| `favourites` | `status.favourites_count` |
| `replies` | `status.replies_count` |
| `reposts` | `status.reblogs_count` |
| `mentionsMe` | currently `false` for Mastodon statuses |
| `source` | `timeline`, `list`, or `notification` depending on where it was collected |

The HTML stripping is intentionally simple. It converts line breaks to newlines, removes tags, decodes a few common entities, and trims whitespace. If report text looks wrong, inspect the original Mastodon HTML before changing the shared renderer.

### 4. Mastodon notifications are normalised

A Mastodon notification becomes a common notification with these mappings:

| Common field | Mastodon source |
| --- | --- |
| `id` | `notification.id` |
| `network` | literal `mastodon` |
| `type` | `notification.type` |
| `author` | `notification.account`, normalised like a status author |
| `post` | `notification.status`, normalised as a `notification` source when present |
| `createdAt` | `notification.created_at` |

Notifications without an embedded status still appear in the notifications section, but they will not add a notification-sourced post to the scored post queue.

### 5. The window filter removes old content

After normalisation, the collector keeps only posts and notifications whose `createdAt` is greater than or equal to the run's `since` date. The default `since` date is calculated from `sinceHours` in config, but the CLI can override it with `--since-hours`.

### 6. Data is stored in SQLite

Collected Mastodon posts are written to the `posts` table with primary keys like `mastodon:110000000000000000`. Mastodon notifications are written to the `notifications` table with primary keys like `mastodon:12345`. If a notification has an embedded post, `notifications.post_id` points to the related `posts.id` value.

See [Database schema](database-schema.md) for table definitions and relationships.

### 7. The shared scorer ranks posts

The Mastodon report does not have a Mastodon-specific scorer. After storage, all collected posts from all enabled networks are de-duplicated and scored together. The renderer then groups the scored posts back by `network` and writes `mastodon.md` from the Mastodon subset.

This means changing topic keywords affects Mastodon and Bluesky reports at the same time.

## Debugging checklist

### A post is missing

Check these in order:

1. Was Mastodon requested by the CLI and enabled in config?
2. Is the post newer than the report's `Window start`?
3. Would the post have been returned in the first `maxItemsPerNetwork` items for the relevant endpoint?
4. If it is a list post, does the configured list title match the Mastodon list title case-insensitively?
5. If it is notification-related, did the notification payload include a `status`?
6. Was it de-duplicated because the same status was already collected from another source?

### A post is in the wrong section

Look at the `Reasons` line in the report.

- If it says `not eligible for technical relevance: no positive topic match`, add or refine a positive topic if the post is genuinely relevant.
- If it says `negative topic`, confirm whether the negative phrase is too broad.
- If it only has engagement reasons, it belongs in the off-topic awareness bucket until topics are changed.

### Notifications look incomplete

Remember that the notifications section is a rendered list of notification objects, not a full conversation view. Open the linked original Mastodon post for context. If a notification has no post link, the Mastodon API payload likely did not include `status` for that notification type.

## Future Mastodon improvements

Useful future changes would be:

- infer `mentionsMe` for Mastodon statuses when the account identity is available;
- store the Mastodon list title or source detail, not only the generic `list` source;
- add pagination if `maxItemsPerNetwork` is not enough for busy accounts;
- persist scores and score reasons if old report interpretation needs to be queryable from SQLite;
- introduce safer HTML-to-text conversion for more entities and edge cases.
