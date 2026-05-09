# Research reports: how to read and maintain them

This directory documents the `dnb-social-report` prototype from the point of view of someone who will read its reports, tune its research topics, or extend the collectors later. It is intentionally written as durable project documentation: if you return in a year, start here before changing scoring rules or adding a network.

## Two roads into the documentation

There are two useful entry points, depending on the question you have.

1. **Topic/research road:** start with this file when you want to understand how to read a generated report, how relevance is decided, or how daily and weekly review should work.
2. **Network road:** start with [Mastodon reports](mastodon-reports.md) when you are looking at `mastodon.md`, debugging Mastodon collection, or changing how Mastodon data is normalised.

The roads deliberately meet in shared concepts: all networks are normalised into the same internal post and notification shapes, then scored with the same topic configuration, stored in the same SQLite database, and rendered through the same Markdown report writer. Network-specific documents explain what enters the pipeline; this document explains how to interpret what comes out.

## One-page mental model

A run of the tool does five things:

1. **Load configuration.** The CLI reads `config.json`, resolves `${ENVIRONMENT_VARIABLE}` placeholders, and validates the result. Important research settings are `sinceHours`, `maxItemsPerNetwork`, and `topics.positive` / `topics.negative`.
2. **Collect network data.** Enabled collectors fetch recent timelines and notifications. Mastodon currently reads the home timeline, configured list timelines, and notifications. Bluesky reads the home timeline and notifications.
3. **Normalise content.** Network payloads are converted into common `SocialPost` and `SocialNotification` content types so the rest of the system does not need to know each API's native field names.
4. **Persist snapshots.** Normalised posts and notifications are inserted into `social-report.sqlite` with stable ids of the form `<network>:<native-id>`. Re-running a window replaces the same row instead of duplicating it.
5. **Score and render.** Posts are de-duplicated, scored against configured topics and engagement, sorted by score, and written into timestamped Markdown files under `reports/<generated-at>/`.

The current system is a read-only decision-support tool. It does not follow, unfollow, mute, block, reply, repost, or send messages.

## Generated report files

Each run creates a timestamped directory inside the configured `outputDirectory`.

```text
reports/
└── 2026-05-09T10-15-30-000Z/
    ├── index.md
    ├── mastodon.md
    └── bluesky.md
```

The exact timestamp is the ISO generation time with colons and dots replaced by hyphens so it is safe as a directory name.

### `index.md`: cross-network overview

Use `index.md` for a quick daily scan. It contains:

- **Generated** and **Window start** timestamps, which define the collection window.
- A **Network reports** table with one row for each enabled network and links to the per-network files.
- **Top 5 cross-network technical posts**, selected from posts that have at least one positive topic match and a score greater than zero.
- **Manual next actions**, which are reminders for human review rather than automation instructions.

The overview is not a complete archive. It is a prioritised entry point. If something looks important, open the linked network report and, if needed, the original post URL.

### Per-network reports

Each network report, including `mastodon.md`, uses the same layout:

- **Most relevant technical posts**
- **High-engagement but off-topic posts**
- **Political/noise-heavy posts to review**
- **Mentions and notifications**
- **Account review suggestions**
- **Manual next actions**

Read the sections in that order during daily triage. Read them in reverse order during weekly account hygiene if the goal is to find noisy accounts rather than immediate reply opportunities.

## How to read scored posts

Every rendered post has a heading, a score line, quoted text, and reasons.

```markdown
### **Display Name** (mastodon)

Score: 9 | Source: timeline | Created: 2026-05-09T08:12:00.000Z

> Post text...

Reasons: topic match: typescript; engagement score: 4; contains link
```

Interpret the fields as follows:

| Field | Meaning | How to use it |
| --- | --- | --- |
| Score | The final prioritisation score after topic, notification, engagement, link, short-post, and noise rules. | Higher scores should be reviewed first, but the score is a hint, not a decision. |
| Source | Where the normalised post came from: `timeline`, `list`, or `notification`. | Notification posts and list posts often deserve faster review because they are either directed at you or curated by you. |
| Created | The network-provided timestamp for the post. | Use this with the report's window start to judge freshness. |
| Reasons | Human-readable scoring factors. | Use these to tune `topics.positive` and `topics.negative`; do not treat a score without reasons as meaningful. |

## Scoring rules in plain English

The scorer builds a lower-cased search string from post text, author handle, and author display name. It then applies these rules:

| Rule | Effect |
| --- | ---: |
| Each positive topic match | `+3` |
| Each negative topic match | `-5` |
| Mentions you | `+8` |
| Comes from notifications | `+4` |
| Engagement from favourites, reposts, and replies | `+1` to `+10`, logarithmically capped |
| Contains an HTTP(S) link in the text | `+1` |
| Very short post, less than 20 characters | `-2` |
| Negative topic with no positive topic | Score capped at `0` |
| No positive topic | Marked as not eligible for technical relevance |

Engagement is calculated as:

```text
favourites + reposts * 2 + replies * 3
```

That weighted number is converted into a small score with a logarithmic scale and capped at `10`. This prevents a viral off-topic post from dominating the report solely because it has large counts.

## Reading each section

### Most relevant technical posts

This is the primary research queue. A post appears here only when it has a positive topic match and a score above zero. Use it for:

- reply opportunities where you can add concrete technical value;
- articles, release notes, and tooling ideas to save for later;
- accounts that repeatedly publish relevant material and may belong in a topic list.

If this section is empty for several days, either the social graph is not producing matching content or `topics.positive` is too narrow.

### High-engagement but off-topic posts

These posts do not match positive topics, but they have enough engagement to receive a positive score. Use the section as ambient awareness, not as the main work queue. It helps answer: "What was loud in the feed even if it was not directly useful?"

If this section frequently contains things you never want to see, add stable phrases to `topics.negative` or consider muting accounts manually.

### Political/noise-heavy posts to review

These posts matched one or more negative topics and no positive topic. They are separated so they do not pollute technical triage. Use this section during weekly review to identify accounts, boosts, or subjects that repeatedly drag attention away from the research goal.

Do not immediately unfollow from a single entry. Look for repetition across multiple reports.

### Mentions and notifications

This is the social obligation queue. It is not sorted by score in the current renderer; it is the first notifications returned by the collector after filtering by the report window. Review it daily for:

- direct mentions;
- replies that need an answer;
- follows or favourites from accounts worth checking;
- notification posts that may also appear in the scored sections.

### Account review suggestions

This section currently contains low-scoring posts that are not already in the noise-heavy section. It is a weak signal. Use it as a weekly prompt to ask whether a source is still worth attention, not as an automatic unfollow list.

## Tuning the research topics

Topic configuration lives in `config.json`, usually copied from `config.example.json`.

```json
"topics": {
  "positive": ["typescript", "astro", "self hosting"],
  "negative": ["election", "culture war", "conspiracy"]
}
```

Guidelines:

- Prefer stable, lower-ambiguity phrases over generic words. `technical seo` is usually better than `seo`; `self hosting` is usually better than `host`.
- Add positive topics when useful posts repeatedly land in off-topic or account-review sections.
- Add negative topics when the same unwanted subject repeatedly appears without any technical value.
- Avoid adding people names as negative topics unless the project goal is explicitly to filter those names.
- Re-run with a 24-hour window after changes, then compare the new report with the previous report before deciding the change is good.

## Configuration fields that affect research output

| Field | Default | Effect |
| --- | --- | --- |
| `databasePath` | `./social-report.sqlite` | Where snapshots are stored. Change only if you intentionally want a new history. |
| `outputDirectory` | `./reports` | Where timestamped Markdown report directories are written. |
| `sinceHours` | `24` | Default lookback window when `--since-hours` is not passed. |
| `maxItemsPerNetwork` | `100` | Maximum number of timeline or notification items requested per source. Mastodon list timelines each use this limit. |
| `topics.positive` | `[]` | Phrases that make a post eligible for technical relevance. |
| `topics.negative` | `[]` | Phrases that lower priority and isolate noise. |
| `networks.*.enabled` | network-specific | A collector only runs when it is both requested by CLI flags and enabled in config. |

## Database orientation

The SQLite database is a snapshot store, not the source of the rendered score. The score is calculated in memory during a run from freshly collected posts and the current config. The database currently stores raw normalised posts and notifications without scores or topic matches.

For table details and relationships, see [Database schema](database-schema.md).

## Daily and weekly operating rhythm

The README contains the short checklist. The expanded version is:

### Daily

1. Load environment variables and run the report for the normal 24-hour window.
2. Open the newest `reports/<timestamp>/index.md`.
3. Review the top cross-network posts.
4. Open each per-network report and clear the mentions/notifications section.
5. Reply, bookmark, add to lists, mute, or unfollow manually in the original network UI. Do not automate actions from the report.
6. Note topic misses in a scratch file or issue, but avoid changing topics after every single report.

### Weekly

1. Review several reports together, especially the noise-heavy and account-review sections.
2. Update `topics.positive` and `topics.negative` based on repeated patterns.
3. Check whether Mastodon lists in config still match actual list names on the instance.
4. Backup or archive `social-report.sqlite` and old report directories if you want long-term history.
5. Run `npm run check` before committing changes to code or documentation.

## Known limitations

- Scores are not persisted, so old reports are the durable record of how a post was ranked at generation time.
- Topic matching is substring-based and case-insensitive; it does not understand word boundaries, stemming, language, sarcasm, or context.
- Mastodon mentions are not currently inferred from the status `mentions` array; notification-derived Mastodon posts have source `notification` but `mentionsMe` remains false.
- Bluesky notification posts currently use zero engagement counts because notification payloads do not provide the same counters as timeline post views.
- The report is only as complete as the network API pages requested by `maxItemsPerNetwork`; it is not a full historical crawler.
