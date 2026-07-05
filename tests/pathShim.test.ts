import { describe, it, expect } from 'vitest';
import pathShim, { join } from '../src/shims/path';

describe('path shim (usado por kuromoji vía alias de vite)', () => {
  it('joins segments with single slashes', () => {
    expect(join('a', 'b', 'c.gz')).toBe('a/b/c.gz');
    expect(join('a/', '/b/', 'c.gz')).toBe('a/b/c.gz');
  });
  it('preserves the chrome-extension:// scheme', () => {
    expect(join('chrome-extension://abc/kuromoji/', 'base.dat.gz')).toBe(
      'chrome-extension://abc/kuromoji/base.dat.gz',
    );
  });
  it('exposes join on the default export for cjs interop', () => {
    expect(pathShim.join('a', 'b')).toBe('a/b');
  });
});
