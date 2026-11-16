import type { ReactNode } from 'react';

// Renders the small markdown subset the summaries use: headings, paragraphs, lists, bold, italic, code.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-raised px-1 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/;

export function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = text.split(/\n{2,}/).flatMap((block) => {
    // A heading directly followed by text (no blank line) becomes two blocks.
    const lines = block.split('\n');
    const out: string[] = [];
    let rest: string[] = [];
    for (const line of lines) {
      if (/^#{1,6}\s/.test(line)) {
        if (rest.length) out.push(rest.join('\n'));
        rest = [];
        out.push(line);
      } else {
        rest.push(line);
      }
    }
    if (rest.length) out.push(rest.join('\n'));
    return out.map((b) => b.trim()).filter(Boolean);
  });

  return (
    <div className="space-y-3 text-base leading-relaxed">
      {blocks.map((block, i) => {
        const cursor = streaming && i === blocks.length - 1 ? 'stream-cursor' : '';
        const heading = /^(#{1,6})\s+(.*)$/.exec(block);
        if (heading) {
          return (
            <h3 key={i} className={`pt-3 text-lg leading-snug font-bold ${cursor}`}>
              {inline(heading[2])}
            </h3>
          );
        }
        const lines = block.split('\n');
        if (lines.every((line) => LIST_ITEM.test(line))) {
          return (
            <ul key={i} className={`list-disc space-y-1 pl-5 ${cursor}`}>
              {lines.map((line, j) => (
                <li key={j}>{inline(line.replace(LIST_ITEM, ''))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className={cursor}>
            {inline(lines.join(' '))}
          </p>
        );
      })}
    </div>
  );
}
