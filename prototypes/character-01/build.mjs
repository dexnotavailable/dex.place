// Inline src/*.js into shell.html. Writes:
//   dist/crimson-halo-lab.html  (fragment, for publishing as an artifact)
//   index.html                  (standalone page for opening locally)
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
const dir = new URL('.', import.meta.url).pathname;
const files = readdirSync(dir + 'src').filter((f) => f.endsWith('.js')).sort();
const js = files.map((f) => `// ---- ${f}\n` + readFileSync(dir + 'src/' + f, 'utf8')).join('\n');
const shell = readFileSync(dir + 'shell.html', 'utf8');
const frag = shell.replace('/*SCRIPTS*/', () => js);
mkdirSync(dir + 'dist', { recursive: true });
writeFileSync(dir + 'dist/crimson-halo-lab.html', frag);
const title = frag.match(/<title>.*?<\/title>/)[0];
const rest = frag.replace(title, '');
writeFileSync(dir + 'index.html', `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${title}\n</head>\n<body>\n${rest}\n</body>\n</html>\n`);
console.log('built', files.length, 'modules,', (frag.length / 1024).toFixed(1), 'KB');
