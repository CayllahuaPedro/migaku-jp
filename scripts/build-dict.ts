import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { transformJmdict, transformPitch } from '../src/data/transform';

const JMDICT_RAW = 'data/raw/jmdict-eng.json';
const ACCENTS_RAW = 'data/raw/accents.txt';

for (const f of [JMDICT_RAW, ACCENTS_RAW]) {
  if (!existsSync(f)) {
    console.error(`Falta ${f} — ver README de data/ para descargarlo`);
    process.exit(1);
  }
}

mkdirSync('public/dict', { recursive: true });

const raw = JSON.parse(readFileSync(JMDICT_RAW, 'utf8'));
const entries = transformJmdict(raw.words);
writeFileSync('public/dict/jmdict.min.json', JSON.stringify(entries));
console.log(`jmdict.min.json: ${entries.length} entradas`);

const pitch = transformPitch(readFileSync(ACCENTS_RAW, 'utf8'));
writeFileSync('public/dict/pitch.json', JSON.stringify(pitch));
console.log(`pitch.json: ${Object.keys(pitch).length} claves`);
