import { describe, it, expect, vi } from 'vitest';
import { SubtitleOverlay } from '../src/ui/SubtitleOverlay';
import { syncOverlay } from '../src/ui/SubtitleOverlay/sync';
import { OVERLAY_CSS } from '../src/ui/SubtitleOverlay/styles';

const hostOf = (c: HTMLElement) => c.querySelector('[data-mjp-overlay]') as HTMLElement;

describe('SubtitleOverlay', () => {
  it('mounts a shadow host with data-mjp-overlay in the container', () => {
    const c = document.createElement('div');
    new SubtitleOverlay(c);
    expect(hostOf(c)?.shadowRoot).toBeTruthy();
  });

  it('renders primary above secondary and hides empty lines', () => {
    const c = document.createElement('div');
    const o = new SubtitleOverlay(c);
    o.setLines('こんにちは', 'Hello');
    const root = hostOf(c).shadowRoot!;
    const lines = [...root.querySelectorAll('.mjp-sub-line')].map((l) => l.textContent);
    expect(lines).toEqual(['こんにちは', 'Hello']);
    o.setLines(null, null);
    expect(root.querySelectorAll('.mjp-sub-line')).toHaveLength(0);
  });

  it('escapes text (no HTML injection)', () => {
    const c = document.createElement('div');
    new SubtitleOverlay(c).setLines('<img src=x>', null);
    expect(hostOf(c).shadowRoot!.querySelector('img')).toBeNull();
  });

  it('destroy removes the host', () => {
    const c = document.createElement('div');
    new SubtitleOverlay(c).destroy();
    expect(hostOf(c)).toBeNull();
  });

  const nextMutation = () => new Promise((r) => setTimeout(r, 0));
  const YOUTUBE_CLASSES = { controlsHiddenClass: 'ytp-autohide', suppressedClass: 'ad-showing' };

  it('toggles data-mjp-controls-hidden with the configured controls-hidden class', async () => {
    const c = document.createElement('div');
    const o = new SubtitleOverlay(c, YOUTUBE_CLASSES);
    expect(hostOf(c).hasAttribute('data-mjp-controls-hidden')).toBe(false);
    c.classList.add('ytp-autohide');
    await nextMutation();
    expect(hostOf(c).hasAttribute('data-mjp-controls-hidden')).toBe(true);
    c.classList.remove('ytp-autohide');
    await nextMutation();
    expect(hostOf(c).hasAttribute('data-mjp-controls-hidden')).toBe(false);
    o.destroy();
  });

  it('starts with the hidden attribute when the container is already autohidden', () => {
    const c = document.createElement('div');
    c.className = 'ytp-autohide';
    new SubtitleOverlay(c, YOUTUBE_CLASSES);
    expect(hostOf(c).hasAttribute('data-mjp-controls-hidden')).toBe(true);
  });

  it('hides the overlay while the container has the configured suppressed class', async () => {
    const c = document.createElement('div');
    const o = new SubtitleOverlay(c, YOUTUBE_CLASSES);
    expect(hostOf(c).hasAttribute('data-mjp-suppressed')).toBe(false);
    c.classList.add('ad-showing');
    await nextMutation();
    expect(hostOf(c).hasAttribute('data-mjp-suppressed')).toBe(true);
    c.classList.remove('ad-showing');
    await nextMutation();
    expect(hostOf(c).hasAttribute('data-mjp-suppressed')).toBe(false);
    o.destroy();
  });

  it('starts hidden when the container already has the suppressed class', () => {
    const c = document.createElement('div');
    c.className = 'ad-showing';
    new SubtitleOverlay(c, YOUTUBE_CLASSES);
    expect(hostOf(c).hasAttribute('data-mjp-suppressed')).toBe(true);
  });

  it('styles the suppressed host as display none', () => {
    expect(OVERLAY_CSS.replace(/\s+/g, ' ')).toContain(':host([data-mjp-suppressed]) { display: none; }');
  });

  it('tracks no container classes unless configured', async () => {
    const c = document.createElement('div');
    c.className = 'ytp-autohide ad-showing';
    new SubtitleOverlay(c);
    await nextMutation();
    expect(hostOf(c).hasAttribute('data-mjp-controls-hidden')).toBe(false);
    expect(hostOf(c).hasAttribute('data-mjp-suppressed')).toBe(false);
  });

  it('links the fonts stylesheet on the document', () => {
    document.getElementById('mjp-fonts')?.remove();
    new SubtitleOverlay(document.createElement('div'));
    expect(document.getElementById('mjp-fonts')).toBeTruthy();
  });
});

describe('syncOverlay', () => {
  it('updates on timeupdate and seeked, and detach stops it', () => {
    const c = document.createElement('div');
    const video = document.createElement('video');
    const o = new SubtitleOverlay(c);
    const spy = vi.spyOn(o, 'setLines');
    const detach = syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }]);
    Object.defineProperty(video, 'currentTime', { value: 1, configurable: true });
    video.dispatchEvent(new Event('timeupdate'));
    expect(spy).toHaveBeenLastCalledWith('あ', 'a');
    Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
    video.dispatchEvent(new Event('seeked'));
    expect(spy).toHaveBeenLastCalledWith(null, null);
    detach();
    video.dispatchEvent(new Event('timeupdate'));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders the active cue on attach without waiting for playback events', () => {
    const c = document.createElement('div');
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentTime', { value: 1, configurable: true });
    const o = new SubtitleOverlay(c);
    const spy = vi.spyOn(o, 'setLines');
    syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }]);
    expect(spy).toHaveBeenCalledWith('あ', 'a');
  });

  it('clears lines left by a previous attach when no cue is active', () => {
    const c = document.createElement('div');
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
    const o = new SubtitleOverlay(c);
    o.setLines('古い', 'old');
    const spy = vi.spyOn(o, 'setLines');
    syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }]);
    expect(spy).toHaveBeenCalledWith(null, null);
  });
});
