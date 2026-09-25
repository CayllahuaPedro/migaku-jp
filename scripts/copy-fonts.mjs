import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'public/fonts';
const SOURCES = [
  { pkg: 'zen-maru-gothic', family: 'Yabai Maru', files: ['japanese-500', 'japanese-700', 'latin-500', 'latin-700'] },
  { pkg: 'inter', family: 'Yabai Inter', files: ['latin-400', 'latin-600'] },
];

if (!existsSync('node_modules/@fontsource/inter')) {
  console.warn('fontsource packages not found; run npm install first');
  process.exit(0);
}
mkdirSync(OUT, { recursive: true });

const css = SOURCES.flatMap(({ pkg, family, files }) =>
  files.map((name) => {
    const dir = `node_modules/@fontsource/${pkg}`;
    return readFileSync(`${dir}/${name}.css`, 'utf8')
      .replace(/font-family: '[^']+'/g, `font-family: '${family}'`)
      .replace(/, url\([^)]+\.woff\) format\('woff'\)/g, '')
      .replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, (_, file) => {
        copyFileSync(`${dir}/files/${file}`, `${OUT}/${file}`);
        return `url(./${file})`;
      });
  }),
).join('\n');

writeFileSync(`${OUT}/fonts.css`, css);
console.log(`Fonts copied to ${OUT}/`);
