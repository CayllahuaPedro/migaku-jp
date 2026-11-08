import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { NATIVE_LANGS, getSettings, saveSettings, watchSettings } from '../src/core/settings';

describe('settings', () => {
  beforeEach(() => fakeBrowser.reset());

  it('returns defaults when nothing is stored', async () =>
    expect(await getSettings()).toEqual({ youtubeDualSubs: true, nativeLang: 'en', pauseOnLookup: true }));

  it('merges a partial save over defaults', async () => {
    await saveSettings({ nativeLang: 'es' });
    expect(await getSettings()).toEqual({ youtubeDualSubs: true, nativeLang: 'es', pauseOnLookup: true });
  });

  it('persists pauseOnLookup without touching other fields', async () => {
    await saveSettings({ pauseOnLookup: false });
    expect(await getSettings()).toEqual({ youtubeDualSubs: true, nativeLang: 'en', pauseOnLookup: false });
  });

  it('notifies watchers with the full merged settings and stops after unsubscribe', async () => {
    const cb = vi.fn();
    const off = watchSettings(cb);
    await saveSettings({ youtubeDualSubs: false });
    expect(cb).toHaveBeenLastCalledWith({ youtubeDualSubs: false, nativeLang: 'en', pauseOnLookup: true });
    off();
    await saveSettings({ nativeLang: 'pt' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('offers English and Spanish among native languages, not Japanese', () => {
    const codes = NATIVE_LANGS.map((l) => l.code);
    expect(codes).toEqual(expect.arrayContaining(['en', 'es']));
    expect(codes).not.toContain('ja');
  });
});
