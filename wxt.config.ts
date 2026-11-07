import { defineConfig } from 'wxt';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  vite: () => ({
    resolve: {
      alias: {
        path: fileURLToPath(new URL('./src/shims/path.ts', import.meta.url)),
      },
    },
  }),
  manifest: {
    name: 'Yabai-JP',
    description: 'Japanese furigana, pitch accent colouring and dictionary — fully offline',
    permissions: ['activeTab', 'storage'],
    web_accessible_resources: [
      { resources: ['kuromoji/*', 'dict/*', 'fonts/*'], matches: ['<all_urls>'] },
    ],
  },
});
