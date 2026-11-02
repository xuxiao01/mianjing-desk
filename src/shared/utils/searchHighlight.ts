export interface HighlightPart {
  text: string;
  highlighted: boolean;
}

/** Prepared terms can be shared by every cell for the current query. */
export function highlightTerms(query: string): readonly string[] {
  return [...new Set(query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean))];
}

export function splitHighlightText(
  text: string,
  query: string | readonly string[],
): HighlightPart[] {
  if (!text) return [];
  const terms = typeof query === 'string' ? highlightTerms(query) : query;
  if (!terms.length) return [{ text, highlighted: false }];
  const folded = text.toLocaleLowerCase();
  // Case folding can expand a character (e.g. İ); retain positions in the original text.
  const offsets: { start: number; end: number }[] = [];
  if (folded.length !== text.length) {
    let start = 0;
    for (const character of text) {
      const end = start + character.length;
      for (let i = 0; i < character.toLocaleLowerCase().length; i++) offsets.push({ start, end });
      start = end;
    }
  }
  const matches: { start: number; end: number }[] = [];
  for (const term of terms) {
    if (!term) continue;
    let from = 0;
    while (from < folded.length) {
      const start = folded.indexOf(term, from);
      if (start < 0) break;
      const end = start + term.length;
      matches.push({
        start: offsets.length ? offsets[start]!.start : start,
        end: offsets.length ? offsets[end - 1]!.end : end,
      });
      from = start + 1;
    }
  }
  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof matches = [];
  for (const match of matches) {
    const previous = merged.at(-1);
    if (previous && match.start <= previous.end) previous.end = Math.max(previous.end, match.end);
    else merged.push({ ...match });
  }
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const { start, end } of merged) {
    if (cursor < start) parts.push({ text: text.slice(cursor, start), highlighted: false });
    parts.push({ text: text.slice(start, end), highlighted: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false });
  return parts;
}
