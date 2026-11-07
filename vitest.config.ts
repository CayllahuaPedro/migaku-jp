import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  resolve: {
    alias: [{ find: /^wxt\/testing$/, replacement: 'wxt/testing/fake-browser' }],
  },
  test: {
    environment: 'happy-dom',
  },
});
