export const TOPIC_LABELS = [
  'LLMs & Reasoning',
  'Agents & Tool Use',
  'Multimodal & Vision',
  'Image & Video Generation',
  'Audio & Speech',
  'Robotics & Embodied AI',
  'Efficiency & Inference',
  'Training & Data',
  'Alignment & Safety',
  'Benchmarks & Evaluation',
  'Science & Health',
  'Other',
] as const;

export type TopicLabel = (typeof TOPIC_LABELS)[number];

export type Period = 'week' | 'month';

export interface Paper {
  arxivId: string; // e.g. '2611.01234'
  title: string;
  authors: string[];
  abstract: string;
  upvotes: number;
  publishedAt: string; // ISO date
  thumbnailUrl?: string;
  githubUrl?: string;
  topic?: TopicLabel; // absent until the paper has been labelled (needs the API key)
  secondaryTopic?: TopicLabel;
}

export type SummaryType = 'short' | 'long';

export interface Summary {
  arxivId: string;
  type: SummaryType;
  text: string; // markdown
  model: string;
  createdAt: string;
}

export interface Favourite {
  arxivId: string;
  savedAt: string;
  paper: Paper; // snapshot, so it survives leaving the hot list
  summaries: Summary[]; // copied in when saved / when generated later
}
