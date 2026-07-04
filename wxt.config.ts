import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Migaku-JP',
    description: 'Japonés: furigana, pitch accent y diccionario, todo local',
    permissions: ['activeTab'],
    web_accessible_resources: [
      { resources: ['kuromoji/*', 'dict/*'], matches: ['<all_urls>'] },
    ],
  },
});
