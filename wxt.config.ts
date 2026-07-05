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
    name: 'Migaku-JP',
    description: 'Japonés: furigana, pitch accent y diccionario, todo local',
    permissions: ['activeTab'],
    web_accessible_resources: [
      { resources: ['kuromoji/*', 'dict/*'], matches: ['<all_urls>'] },
    ],
  },
});
