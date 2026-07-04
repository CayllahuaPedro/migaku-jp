import { describe, it, expect } from 'vitest';
import { classifyPitch } from '../src/core/pitch';

describe('classifyPitch', () => {
  it('heiban when accent is 0', () => {
    expect(classifyPitch('さくら', 0)).toBe('heiban');
  });
  it('atamadaka when accent is 1', () => {
    expect(classifyPitch('ねこ', 1)).toBe('atamadaka');
    expect(classifyPitch('ひ', 1)).toBe('atamadaka');
  });
  it('odaka when accent equals mora count', () => {
    expect(classifyPitch('はな', 2)).toBe('odaka');
  });
  it('nakadaka when accent is in the middle', () => {
    expect(classifyPitch('こころ', 2)).toBe('nakadaka');
  });
  it('counts moras, not characters', () => {
    // きゃく = 2 moras; accent 2 = odaka (no nakadaka)
    expect(classifyPitch('きゃく', 2)).toBe('odaka');
  });
  it('unknown for null or out-of-range', () => {
    expect(classifyPitch('ねこ', null)).toBe('unknown');
    expect(classifyPitch('ねこ', 9)).toBe('unknown');
    expect(classifyPitch('ねこ', -1)).toBe('unknown');
  });
});
