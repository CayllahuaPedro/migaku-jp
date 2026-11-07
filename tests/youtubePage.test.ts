import { afterEach, describe, expect, it } from 'vitest';
import { setNativeHidden } from '../src/surfaces/youtube/page';

const hideStyles = () => document.head.querySelectorAll('style[data-mjp-native-hide]');

describe('setNativeHidden', () => {
  afterEach(() => setNativeHidden(false));

  it('injects a single hiding style however often it is called', () => {
    setNativeHidden(true);
    setNativeHidden(true);
    expect(hideStyles()).toHaveLength(1);
    expect(hideStyles()[0].textContent).toContain('.ytp-caption-window-container { display: none !important; }');
  });

  it('removes the style when native captions are shown again', () => {
    setNativeHidden(true);
    setNativeHidden(false);
    setNativeHidden(false);
    expect(hideStyles()).toHaveLength(0);
  });
});
