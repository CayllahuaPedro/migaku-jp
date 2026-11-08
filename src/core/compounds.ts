import { hiraganaToKatakana } from './kana';
import type { JpToken } from './tokenizer';

export const MAX_COMPOUND_TOKENS = 4;

const EXCLUDED_NOUN_DETAILS = new Set(['非自立', '代名詞', '数']);

export function isCompoundEligible(t: JpToken): boolean {
  if (t.pos === '接頭詞') return true;
  return t.pos === '名詞' && !EXCLUDED_NOUN_DETAILS.has(t.posDetail);
}

function eligibleRunEnd(tokens: JpToken[], start: number): number {
  const limit = Math.min(tokens.length, start + MAX_COMPOUND_TOKENS);
  let end = start;
  while (end < limit && isCompoundEligible(tokens[end])) end++;
  return end;
}

export function compoundCandidates(tokens: JpToken[]): string[] {
  const seen = new Set<string>();
  for (let start = 0; start < tokens.length; start++) {
    const end = eligibleRunEnd(tokens, start);
    for (let len = 2; start + len <= end; len++) {
      seen.add(
        tokens
          .slice(start, start + len)
          .map((t) => t.surface)
          .join(''),
      );
    }
  }
  return [...seen];
}

export function mergeCompounds(
  tokens: JpToken[],
  found: Record<string, string>,
): JpToken[] {
  const result: JpToken[] = [];
  let i = 0;
  while (i < tokens.length) {
    const end = eligibleRunEnd(tokens, i);
    let merged: JpToken | null = null;
    let len = end - i;
    for (; len >= 2; len--) {
      const parts = tokens.slice(i, i + len);
      const surface = parts.map((t) => t.surface).join('');
      if (surface in found) {
        merged = {
          surface,
          basicForm: surface,
          reading: hiraganaToKatakana(found[surface]),
          pos: '名詞',
          posDetail: '複合',
          parts: parts.map((t) => ({
            surface: t.surface,
            basicForm: t.basicForm,
            reading: t.reading,
          })),
        };
        break;
      }
    }
    if (merged) {
      result.push(merged);
      i += len;
    } else {
      result.push(tokens[i]);
      i++;
    }
  }
  return result;
}
