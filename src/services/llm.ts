import Anthropic from '@anthropic-ai/sdk';
import { TOPIC_LABELS, type Paper, type TopicLabel } from '../types';

export const LABEL_MODEL = 'claude-haiku-5-5';
export const SHORT_MODEL = 'claude-haiku-5-5';
export const LONG_MODEL = 'claude-sonnet-5-5';

const LABEL_PROMPT = `You classify AI research papers. For each paper below, choose exactly one primary
label and at most one secondary label from this list:
[LLMs & Reasoning, Agents & Tool Use, Multimodal & Vision, Image & Video Generation,
Audio & Speech, Robotics & Embodied AI, Efficiency & Inference, Training & Data,
Alignment & Safety, Benchmarks & Evaluation, Science & Health, Other]
Return only JSON: [{"arxivId": "...", "topic": "...", "secondaryTopic": "..."|null}]

Papers:
`;

const SHORT_PROMPT = `Summarise this paper in exactly 5 sentences of plain English.
1) What problem it tackles. 2) Why that matters. 3) What the authors did (the core idea,
no jargon). 4) The headline result. 5) Why it might matter for people building or
using AI. No bullet points, no formulas, no hype words.`;

const LONG_PROMPT = `Write a ~1,100-word overview of this paper that takes about 5 minutes to read.
Stay high-level: explain ideas, not maths. Skip formulas, hyperparameters and
ablation details. Use these markdown sections:
## The big picture  ## What they did  ## How it works (intuition only)
## What they found  ## Limitations & open questions  ## Why it matters
Explain any unavoidable technical term in half a sentence. Be accurate; don't
claim results the paper doesn't report.`;

// The key is used directly from the browser; the SDK then sends the
// `anthropic-dangerous-direct-browser-access: true` header.
const client = (apiKey: string) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

const isTopic = (v: unknown): v is TopicLabel => TOPIC_LABELS.includes(v as TopicLabel);

export type Labels = {
  topic: TopicLabel;
  secondaryTopic?: TopicLabel;
};

/** Labels all given papers in one batched call. Papers missing from the reply stay unlabelled. */
export async function classifyPapers(apiKey: string, papers: Paper[]): Promise<Map<string, Labels>> {
  const listing = papers
    .map((p) => `arxivId: ${p.arxivId}\ntitle: ${p.title}\nabstract: ${p.abstract.slice(0, 600)}`)
    .join('\n\n');

  const message = await client(apiKey)
    .messages.stream({
      model: LABEL_MODEL,
      max_tokens: 64000,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: LABEL_PROMPT + listing }],
    })
    .finalMessage();

  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const wanted = new Set(papers.map((p) => p.arxivId));
  const labels = new Map<string, Labels>();
  // Parse entry by entry so code fences or a cut-off reply don't lose the valid entries.
  for (const match of text.matchAll(/\{[^{}]*\}/g)) {
    try {
      const entry = JSON.parse(match[0]) as Record<string, unknown>;
      const id = entry.arxivId;
      if (typeof id !== 'string' || !wanted.has(id) || !isTopic(entry.topic)) continue;
      const secondary = entry.secondaryTopic;
      labels.set(id, {
        topic: entry.topic,
        ...(isTopic(secondary) && secondary !== entry.topic ? { secondaryTopic: secondary } : {}),
      });
    } catch {
      // skip malformed entry
    }
  }
  return labels;
}

async function streamText(
  apiKey: string,
  params: Anthropic.MessageStreamParams,
  onText: (delta: string) => void,
): Promise<void> {
  const stream = client(apiKey).messages.stream(params);
  stream.on('text', onText);
  const message = await stream.finalMessage();
  if (message.stop_reason === 'refusal') throw new Error('The model declined to summarise this paper.');
}

/** Streams the 5-sentence summary. `paperInfo` = title + abstract + HF AI summary if present. */
export function streamShortSummary(apiKey: string, paperInfo: string, onText: (d: string) => void) {
  return streamText(
    apiKey,
    {
      model: SHORT_MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: `<paper>\n${paperInfo}\n</paper>\n\n${SHORT_PROMPT}` }],
    },
    onText,
  );
}

/** Streams the ~5-minute overview. `source` = full text, or abstract + HF metadata as fallback. */
export function streamLongSummary(apiKey: string, source: string, onText: (d: string) => void) {
  return streamText(
    apiKey,
    {
      model: LONG_MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content: `<paper>\n${source}\n</paper>\n\n${LONG_PROMPT}` }],
    },
    onText,
  );
}
