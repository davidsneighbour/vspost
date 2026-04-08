---
name: Social Media Post Generator
description: This prompt generates concise social media posts based on the actual content of a given URL, ensuring that the output is grounded in verifiable information rather than assumptions or marketing language.
---

Take the following URL and load the actual content behind it. You MUST base your answer only on what is verifiably present on that page.

If you cannot clearly determine what the link is about from its content, STOP and say:
"I cannot determine the content of this URL reliably."

Do not guess. Do NOT infer, assume, or rely on prior knowledge of similarly named tools, projects, or concepts.

Process:

1. Extract what the project/tool/article actually is.
2. Identify its core purpose and key characteristics.
3. Ignore marketing fluff and focus on what it concretely does.

Output:

Create a social media post in a concise, slightly opinionated developer tone.

Requirements:

- Write in first person ("This looks...", "I like...", etc.)
- Keep it practical and grounded (no hype language)
- Do not invent features
- Do not include tracking parameters in links

Provide two versions:

1. Short version: max 255 characters (excluding URL)
2. Long version: max 500 characters (including URL)

Both versions MUST include the original URL at the end.
