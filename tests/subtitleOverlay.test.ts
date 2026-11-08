import { describe, it, expect, vi } from 'vitest';
import { SubtitleOverlay } from '../src/ui/SubtitleOverlay';
import { syncOverlay } from '../src/ui/SubtitleOverlay/sync';
import { OVERLAY_CSS } from '../src/ui/SubtitleOverlay/styles';
import { PITCH_COLORS_ON_DARK } from '../src/ui/theme';
import type { RenderToken } from '../src/core/annotate';
import type { LineTokens } from '../src/surfaces/youtube/cueAnnotator';

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
    expect(spy).toHaveBeenLastCalledWith('あ', 'a', null);
    Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
    video.dispatchEvent(new Event('seeked'));
    expect(spy).toHaveBeenLastCalledWith(null, null, null);
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
    expect(spy).toHaveBeenCalledWith('あ', 'a', null);
  });

  it('clears lines left by a previous attach when no cue is active', () => {
    const c = document.createElement('div');
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentTime', { value: 5, configurable: true });
    const o = new SubtitleOverlay(c);
    o.setLines('古い', 'old');
    const spy = vi.spyOn(o, 'setLines');
    syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }]);
    expect(spy).toHaveBeenCalledWith(null, null, null);
  });

  describe('with line tokens', () => {
    const toks: RenderToken[] = [{ surface: 'あ', ruby: null, pattern: 'unknown', basicForm: 'あ' }];
    const setup = () => {
      const map = new Map<string, RenderToken[]>();
      const listeners = new Set<() => void>();
      const lineTokens: LineTokens = {
        get: (text) => map.get(text) ?? null,
        onChange: (cb) => {
          listeners.add(cb);
          return () => listeners.delete(cb);
        },
      };
      const video = document.createElement('video');
      Object.defineProperty(video, 'currentTime', { value: 1, configurable: true });
      const o = new SubtitleOverlay(document.createElement('div'));
      const spy = vi.spyOn(o, 'setLines');
      const detach = syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }], lineTokens);
      return { map, listeners, spy, detach, video };
    };

    it('passes available tokens for the active primary line', () => {
      const map = new Map([['あ', toks]]);
      const lineTokens: LineTokens = { get: (t) => map.get(t) ?? null, onChange: () => () => {} };
      const video = document.createElement('video');
      Object.defineProperty(video, 'currentTime', { value: 1, configurable: true });
      const o = new SubtitleOverlay(document.createElement('div'));
      const spy = vi.spyOn(o, 'setLines');
      syncOverlay(video, o, [{ start: 0, end: 2, text: 'あ' }], [{ start: 0, end: 2, text: 'a' }], lineTokens);
      expect(spy).toHaveBeenCalledWith('あ', 'a', toks);
    });

    it('re-renders the same line when its tokens arrive while paused', () => {
      const { map, listeners, spy } = setup();
      expect(spy).toHaveBeenLastCalledWith('あ', 'a', null);
      map.set('あ', toks);
      listeners.forEach((cb) => cb());
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith('あ', 'a', toks);
    });

    it('does not re-render when nothing changed on notify', () => {
      const { listeners, spy } = setup();
      listeners.forEach((cb) => cb());
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('detach unsubscribes from token changes', () => {
      const { listeners, detach } = setup();
      expect(listeners.size).toBe(1);
      detach();
      expect(listeners.size).toBe(0);
    });
  });
});

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('SubtitleOverlay interactive primary line', () => {
  const tokens: RenderToken[] = [
    { surface: '猫', ruby: 'ねこ', pattern: 'atamadaka', basicForm: '猫', reading: 'ねこ' },
    { surface: '、', ruby: null, pattern: 'unknown', basicForm: '、' },
  ];

  it('renders primary tokens as pitch-classed spans without furigana', () => {
    const c = document.createElement('div');
    new SubtitleOverlay(c).setLines('猫、', 'Cat,', tokens);
    const root = hostOf(c).shadowRoot!;
    const token = root.querySelector('.mjp-sub-primary .mjp-token') as HTMLElement;
    expect(token.classList.contains('mjp-atamadaka')).toBe(true);
    expect(token.dataset.mjpBasicForm).toBe('猫');
    expect(root.querySelector('ruby, rt')).toBeNull();
    expect(root.querySelector('.mjp-sub-primary')!.textContent).toBe('猫、');
    expect(root.querySelector('.mjp-sub-secondary .mjp-token')).toBeNull();
  });

  it('reports a word click with its ref and rect, and swallows the event', () => {
    const onWordClick = vi.fn();
    const c = document.createElement('div');
    const outer = vi.fn();
    c.addEventListener('click', outer);
    new SubtitleOverlay(c, { onWordClick }).setLines('猫、', null, tokens);
    const token = hostOf(c).shadowRoot!.querySelector('.mjp-token') as HTMLElement;
    token.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(onWordClick).toHaveBeenCalledWith({ surface: '猫', basicForm: '猫', reading: 'ねこ' }, expect.anything());
    expect(outer).not.toHaveBeenCalled();
  });

  it.each(['mousedown', 'pointerdown', 'dblclick'])('stops %s on a word from reaching the player', (type) => {
    const c = document.createElement('div');
    const outer = vi.fn();
    c.addEventListener(type, outer);
    new SubtitleOverlay(c, { onWordClick: vi.fn() }).setLines('猫、', null, tokens);
    hostOf(c).shadowRoot!.querySelector('.mjp-token')!
      .dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
    expect(outer).not.toHaveBeenCalled();
  });

  it('lets clicks outside words pass through', () => {
    const c = document.createElement('div');
    const outer = vi.fn();
    c.addEventListener('click', outer);
    new SubtitleOverlay(c, { onWordClick: vi.fn() }).setLines('猫、', 'Cat,', tokens);
    hostOf(c).shadowRoot!.querySelector('.mjp-sub-secondary')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(outer).toHaveBeenCalled();
  });

  it('keeps the primary line element when only the secondary text changes', () => {
    const c = document.createElement('div');
    const overlay = new SubtitleOverlay(c);
    overlay.setLines('猫、', 'Cat,', tokens);
    const root = hostOf(c).shadowRoot!;
    const primary = root.querySelector('.mjp-sub-primary');
    overlay.setLines('猫、', 'Dog', tokens);
    expect(root.querySelector('.mjp-sub-primary')).toBe(primary);
    expect(root.querySelector('.mjp-sub-secondary')!.textContent).toBe('Dog');
  });

  it('keeps the secondary line element when only the primary changes', () => {
    const c = document.createElement('div');
    const overlay = new SubtitleOverlay(c);
    overlay.setLines('猫、', 'Cat,', tokens);
    const root = hostOf(c).shadowRoot!;
    const secondary = root.querySelector('.mjp-sub-secondary');
    overlay.setLines('犬', 'Cat,');
    expect(root.querySelector('.mjp-sub-secondary')).toBe(secondary);
    expect(root.querySelector('.mjp-sub-primary')!.textContent).toBe('犬');
  });

  it('removes lines that become empty and keeps order primary then secondary', () => {
    const c = document.createElement('div');
    const overlay = new SubtitleOverlay(c);
    overlay.setLines(null, 'Cat,');
    overlay.setLines('猫、', 'Cat,', tokens);
    const root = hostOf(c).shadowRoot!;
    expect([...root.querySelectorAll('.mjp-sub-line')].map((l) => l.classList[1])).toEqual([
      'mjp-sub-primary',
      'mjp-sub-secondary',
    ]);
    overlay.setLines('猫、', null, tokens);
    expect(root.querySelector('.mjp-sub-secondary')).toBeNull();
    overlay.setLines(null, null);
    expect(root.querySelector('.mjp-sub')).toBeNull();
  });

  describe('a press that started on a word', () => {
    const press = (c: HTMLElement) => {
      const parentClick = vi.fn();
      document.body.append(c);
      document.body.addEventListener('click', parentClick);
      const overlay = new SubtitleOverlay(c, { onWordClick: vi.fn() });
      overlay.setLines('猫、', null, tokens);
      const token = hostOf(c).shadowRoot!.querySelector('.mjp-token') as HTMLElement;
      token.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }));
      token.remove();
      return { overlay, parentClick };
    };

    it('swallows the stray click on the container, once, and lets later clicks through', () => {
      const c = document.createElement('div');
      const { parentClick } = press(c);
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(parentClick).not.toHaveBeenCalled();
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(parentClick).toHaveBeenCalledTimes(1);
      document.body.removeEventListener('click', parentClick);
    });

    it('stops swallowing on the next macrotask after pointerup', async () => {
      const c = document.createElement('div');
      const { parentClick } = press(c);
      c.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(parentClick).toHaveBeenCalledTimes(1);
      document.body.removeEventListener('click', parentClick);
    });

    it('stops swallowing after destroy', () => {
      const c = document.createElement('div');
      const { overlay, parentClick } = press(c);
      overlay.destroy();
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(parentClick).toHaveBeenCalledTimes(1);
      document.body.removeEventListener('click', parentClick);
    });
  });

  it('does not swallow clicks when no word handler is set', () => {
    const c = document.createElement('div');
    const outer = vi.fn();
    document.body.append(c);
    document.body.addEventListener('click', outer);
    new SubtitleOverlay(c).setLines('猫、', null, tokens);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(outer).toHaveBeenCalledTimes(1);
    document.body.removeEventListener('click', outer);
  });

  it('calls onDestroy on destroy', () => {
    const onDestroy = vi.fn();
    new SubtitleOverlay(document.createElement('div'), { onDestroy }).destroy();
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it('keeps tokens click-through except the words, with dark-background pitch colours', () => {
    expect(OVERLAY_CSS).toMatch(/\.mjp-token[^{]*\{[^}]*pointer-events:\s*auto/);
    expect(OVERLAY_CSS).toMatch(/\.mjp-token[^{]*\{[^}]*cursor:\s*pointer/);
    for (const [pattern, color] of Object.entries(PITCH_COLORS_ON_DARK)) {
      expect(OVERLAY_CSS).toContain(`.mjp-${pattern} { color: ${color}; }`);
    }
  });

  it('dark pitch colours reach 4.5:1 against the line background #080c20', () => {
    for (const color of Object.values(PITCH_COLORS_ON_DARK)) {
      expect(contrast(color, '#080c20')).toBeGreaterThanOrEqual(4.5);
    }
  });
});
