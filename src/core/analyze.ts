import { buildRenderTokens, type RenderToken } from './annotate';
import { compoundCandidates, mergeCompounds } from './compounds';
import type { AnnotateResult, TokenQuery } from './messages';
import type { JpToken } from './tokenizer';

export interface AnalyzeDeps {
  tokenize(text: string): Promise<JpToken[]>;
  findCompounds(forms: string[]): Promise<Record<string, string>>;
  annotate(tokens: TokenQuery[]): Promise<AnnotateResult>;
}

async function findCompoundsSafely(
  tokens: JpToken[],
  deps: AnalyzeDeps,
): Promise<Record<string, string>> {
  const candidates = compoundCandidates(tokens);
  if (candidates.length === 0) return {};
  try {
    return await deps.findCompounds(candidates);
  } catch (error) {
    console.warn('[yabai-jp] compound lookup failed, annotating unmerged', error);
    return {};
  }
}

export async function analyzeText(
  text: string,
  deps: AnalyzeDeps,
): Promise<RenderToken[]> {
  const tokens = await deps.tokenize(text);
  const merged = mergeCompounds(tokens, await findCompoundsSafely(tokens, deps));
  const { accents } = await deps.annotate(
    merged.map((t) => ({
      basicForm: t.basicForm,
      surface: t.surface,
      reading: t.reading,
    })),
  );
  return buildRenderTokens(merged, accents);
}
