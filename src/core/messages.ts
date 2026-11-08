import type { DictEntry, PosTagMap } from './types';

export interface TokenQuery {
  basicForm: string;
  surface: string;
  reading?: string; // katakana, como sale del tokenizer
}

export type Msg =
  | { type: 'ensure-imported' }
  | { type: 'annotate'; tokens: TokenQuery[] }
  | { type: 'find-compounds'; forms: string[] }
  | ({ type: 'lookup' } & TokenQuery & { parts?: TokenQuery[] })
  | { type: 'parse-page' }
  | { type: 'revert-page' };

export interface AnnotateResult { accents: (number | null)[] }
export interface FindCompoundsResult { found: Record<string, string> }
export interface PartResult {
  word: string;
  reading?: string;
  entries: DictEntry[];
}
export interface LookupResult {
  entries: DictEntry[];
  accentPos: number | null;
  posTags: PosTagMap;
  parts?: PartResult[];
}
export interface ErrorResult { error: string }

export function isErrorResult(r: unknown): r is ErrorResult {
  return typeof r === 'object' && r !== null && 'error' in r;
}
