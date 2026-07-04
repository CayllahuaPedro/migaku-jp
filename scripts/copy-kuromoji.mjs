import { cpSync, mkdirSync, existsSync } from 'node:fs';

if (!existsSync('node_modules/kuromoji/dict')) {
  console.warn('kuromoji dict not found; run npm install first');
  process.exit(0);
}
mkdirSync('public/kuromoji', { recursive: true });
cpSync('node_modules/kuromoji/dict', 'public/kuromoji', { recursive: true });
console.log('IPADIC copied to public/kuromoji/');
