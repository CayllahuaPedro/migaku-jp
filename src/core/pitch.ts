import { toMora } from './mora';

export type PitchPattern = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka' | 'unknown';

export function classifyPitch(reading: string, accentPos: number | null): PitchPattern {
  if (accentPos === null || accentPos < 0) return 'unknown';
  const m = toMora(reading).length;
  if (accentPos > m) return 'unknown';
  if (accentPos === 0) return 'heiban';
  if (accentPos === 1) return 'atamadaka';
  if (accentPos === m) return 'odaka';
  return 'nakadaka';
}
