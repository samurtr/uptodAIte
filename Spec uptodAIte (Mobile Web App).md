# Spec: uptodAIte (Mobile Web App)

Nov 9, 2026 · @Samuel

## Goal & context

A private, mobile-first web app (PWA) that pulls the most-upvoted papers of the current week or month from [huggingface.co/papers](https://huggingface.co/papers), lists them by upvotes and explains them briefly with an LLM.

- **User:** just me, one device (phone), no login.
- **Value:** know what's hot in 2 minutes; understand the gist of a paper in about 5 minutes when curious.
- **Non-goals:** no full-text reader, no multi-user features, no deep technical analysis.

## Features & user stories

Seven features for a single user; LLM text is generated only on tap and cached afterwards.

| # | Feature | User story | Acceptance criteria |
| --- | --- | --- | --- |
| F1 | Choose period | As a user I pick "Week" or "Month" to see the matching hot papers. | Segmented control at the top; default = Week; choice is remembered; switching reloads. |
| F2 | Fetch papers | As a user I get the current papers for the chosen period. | On app open and via pull-to-refresh; loading state visible; errors show "Try again". |
| F3 | List by upvotes | As a user I scroll a list sorted by upvotes, highest first. | Each card: rank, title, upvotes, topic label, favourite star. Smooth scrolling with 100+ items. |
| F4 | Topic label | As a user I see at a glance which topic a paper addresses. | Exactly 1 primary label from a fixed list (see LLM prompts), optional 1 secondary label. One colour per label. |
| F5 | Short summary | As a user I tap a paper and read a 5-sentence summary. | Detail view opens instantly; summary streams in ≤ 5 s; exactly 5 sentences, plain language. |
| F6 | Long summary | As a user I tap "Read more" and get a \~5-minute read. | Generated only on tap; \~1,000–1,200 words; high-level, no formulas; with subheadings; streams. |
| F7 | Favourites | As a user I save papers I like and find them again later. | Star in list and detail; own "Favourites" tab; saved summaries persist even after the paper drops out of the hot list. |

## Screens & UI flow

Three screens plus a bottom tab bar (Hot · Favourites); everything is reachable with one thumb.

1. **Hot list** (start screen)
   - Header: app name + segmented control `Week | Month`.
   - Card list sorted by upvotes: rank, title (max. 3 lines), ▲ upvote count, coloured topic chip, ☆ star.
   - Pull-to-refresh; skeleton cards while loading; "Last updated 12 min ago" under the header.
   - Optional filter chip row by topic label (nice-to-have).
2. **Paper detail** (tap on a card)
   - Title, topic chip, upvotes, date, authors (shortened), links: HF page · arXiv · PDF.
   - Short summary (5 sentences) loads automatically and streams in.
   - Button **"Read more (\~5 min)"** → generates the long summary inline below, with a reading-progress indicator.
   - Star button in the top bar; back via swipe or arrow.
3. **Favourites**
   - Same card layout, sorted by date saved (newest first).
   - Tap opens the detail view from local cache (works offline).
   - Swipe left to remove.

**Settings** (gear icon in the header): Claude API key, default period, JSON export/import of favourites, clear stored data.

**Look & feel:** dark mode by default, system font, large tap targets (≥ 44 px), installable to the home screen as a PWA.

## Data source

No HTML scraping needed: Hugging Face exposes the Daily Papers feed as a public JSON API that already filters by ISO week or month ([HF papers skill docs](https://skills.sh/huggingface/skills/hugging-face-paper-pages), [huggingface-papers skill](https://mcpservers.org/vi/agent-skills/huggingface/huggingface-papers)).

| Purpose | Endpoint | Notes |
| --- | --- | --- |
| Hot papers of a week | `GET https://huggingface.co/api/daily_papers?week=2026-W46&limit=100` | `week` = ISO week; page with `p` |
| Hot papers of a month | `GET https://huggingface.co/api/daily_papers?month=2026-11&limit=100` | `month` = `YYYY-MM`; page with `p` |
| Paper metadata | `GET https://huggingface.co/api/papers/{arxivId}` | Abstract, AI summary, authors, upvotes, GitHub/project links |
| Paper full text | `GET https://huggingface.co/papers/{arxivId}.md` | Markdown version of the paper; input for the long summary |

**Rules**

- Week = current ISO week, month = current calendar month (Europe/Berlin). Early in a period the list is short → if fewer than 10 papers, also show the previous period below a divider.
- Fetch all pages (limit 100 each) until a page returns fewer than 100 items.
- Sort client-side by `paper.upvotes` descending; ties by `publishedAt` newest first.
- If the API fails or changes: show the last stored list with a banner (no server-side HTML fallback, since there is no backend).
- API field names must be verified against a live response before building the mapper (the response nests paper data under `paper`).

## Architecture & tech stack

Everything runs in the browser on the phone: a React PWA calls the Hugging Face API and the Claude API directly and keeps all data in IndexedDB. There is no backend and no server-side storage.

&#91;embedded content: architecture · phone-only PWA, two APIs\]

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Vite + React, TypeScript, Tailwind | Fast to build, small bundle, easy PWA setup |
| PWA | `vite-plugin-pwa`, service worker | Home-screen install, offline use |
| Local storage | IndexedDB via Dexie | Paper lists, labels, summaries, favourites, settings — all on the phone |
| Paper data | Direct `fetch` to the HF API from the browser | No proxy needed if CORS allows it (verify in spike) |
| LLM | Claude API called from the browser (header `anthropic-dangerous-direct-browser-access: true`): `claude-haiku-5-5` for labels + short summary, `claude-sonnet-5-5` for the long summary | Cheap and fast for small jobs, better prose for the long read |
| API key | Entered once on a Settings screen, stored only in IndexedDB | Never leaves the phone except in calls to Anthropic |
| Delivery | Static build only (HTML/JS/CSS) | No server logic; see note below |

**Client services** (in `src/services/`)

| Function | Does |
| --- | --- |
| `fetchPapers(period)` | Fetches all pages from HF, maps to `Paper[]`, reuses stored labels, labels new papers in one batch call, stores the list with `fetchedAt` (refetch after 30 min) |
| `getSummary(arxivId, 'short')` | Returns stored short summary or streams a new one (input: abstract) and saves it |
| `getSummary(arxivId, 'long')` | Returns stored long summary or streams a new one (input: `.md` full text, truncated to \~60k tokens) and saves it |

**Getting it onto the phone without hosting:** a PWA only installs over HTTPS (or on localhost). Default: put the static build on a free static file host such as GitHub Pages — it only serves the app files and stores no data. Alternative: wrap the build with Capacitor and install it as a native app.

**Check in a first spike:** the HF API and the `.md` endpoint must accept browser (CORS) requests; if `.md` is blocked, the long summary falls back to abstract + HF metadata. The API key sits in plain device storage — fine for personal use; set a monthly spend limit in the Anthropic console.

## Data model

Three types; the arXiv ID is the key everywhere.

```typescript
type TopicLabel =
  | 'LLMs & Reasoning' | 'Agents & Tool Use' | 'Multimodal & Vision'
  | 'Image & Video Generation' | 'Audio & Speech' | 'Robotics & Embodied AI'
  | 'Efficiency & Inference' | 'Training & Data' | 'Alignment & Safety'
  | 'Benchmarks & Evaluation' | 'Science & Health' | 'Other';

interface Paper {
  arxivId: string;          // e.g. '2611.01234'
  title: string;
  authors: string[];
  abstract: string;
  upvotes: number;
  publishedAt: string;      // ISO date
  thumbnailUrl?: string;
  githubUrl?: string;
  topic: TopicLabel;
  secondaryTopic?: TopicLabel;
}

interface Summary {
  arxivId: string;
  type: 'short' | 'long';
  text: string;             // markdown
  model: string;
  createdAt: string;
}

interface Favourite {
  arxivId: string;
  savedAt: string;
  paper: Paper;             // snapshot, so it survives leaving the hot list
  summaries: Summary[];     // copied in when saved / when generated later
}
```

**IndexedDB stores (Dexie):** `papers` (key arxivId, incl. topic), `lists` (key `period:yyyy-Www|yyyy-mm`, with `fetchedAt`), `summaries` (key `arxivId:type`), `favourites` (key arxivId), `settings` (`period`, `apiKey`). No server-side storage.

## LLM prompts

Three prompts, all written for a curious, technically literate reader who is not a specialist in the paper's subfield.

**1. Topic label** (batch, `claude-haiku-5-5`, JSON output, run once per new paper on list fetch)

```text
You classify AI research papers. For each paper below, choose exactly one primary
label and at most one secondary label from this list:
[LLMs & Reasoning, Agents & Tool Use, Multimodal & Vision, Image & Video Generation,
Audio & Speech, Robotics & Embodied AI, Efficiency & Inference, Training & Data,
Alignment & Safety, Benchmarks & Evaluation, Science & Health, Other]
Return only JSON: [{"arxivId": "...", "topic": "...", "secondaryTopic": "..."|null}]

Papers:
{for each: arxivId, title, first 600 chars of abstract}
```

**2. Short summary** (`claude-haiku-5-5`, input: title + abstract + HF AI summary if present)

```text
Summarise this paper in exactly 5 sentences of plain English.
1) What problem it tackles. 2) Why that matters. 3) What the authors did (the core idea,
no jargon). 4) The headline result. 5) Why it might matter for people building or
using AI. No bullet points, no formulas, no hype words.
```

**3. Long summary** (`claude-sonnet-5-5`, input: full text from `.md`, truncated)

```text
Write a ~1,100-word overview of this paper that takes about 5 minutes to read.
Stay high-level: explain ideas, not maths. Skip formulas, hyperparameters and
ablation details. Use these markdown sections:
## The big picture  ## What they did  ## How it works (intuition only)
## What they found  ## Limitations & open questions  ## Why it matters
Explain any unavoidable technical term in half a sentence. Be accurate; don't
claim results the paper doesn't report.
```

## Caching, cost & error handling

Every LLM output is generated at most once per paper and stored in IndexedDB on the phone, so running cost stays at a few euros per month at most for one user.

**Caching**

- Paper list: stored with `fetchedAt`; shown instantly on open, refreshed in the background if older than 30 min.
- Labels and summaries: stored permanently per arXiv ID.
- Favourites: only on the phone. Clearing browser data deletes them → add JSON export/import in Settings.

**Cost drivers** (exact prices to be checked on the Anthropic pricing page before launch)

- Labels: one batched call per fetch, only for unlabelled papers → cheap.
- Short summary: \~1k input tokens per tap → cheap.
- Long summary: up to \~60k input tokens of full text → the main cost; only on explicit tap.
- Guardrail: daily cap of e.g. 20 long summaries, enforced in the app, plus a spend limit in the Anthropic console.

**Error cases**

| Case | Behaviour |
| --- | --- |
| HF API down / changed | Show stored list + banner "Couldn't refresh" |
| Empty period (e.g. Monday morning) | Also show previous week/month |
| `.md` full text missing or CORS-blocked | Long summary from abstract + HF metadata, with a note "based on abstract only" |
| No API key set | Summaries show "Add your Claude API key in Settings" |
| LLM error / timeout | Keep partial streamed text, show "Retry" |
| Offline | Hot list from storage (read-only), favourites fully usable |

## Decisions

Decided in review; the spec above reflects these.

- [ ] **Hosting:** none. No backend; all data stays on the phone (see Architecture).
- [ ] **Frontend framework:** React.
- [ ] **Summary language:** English.
