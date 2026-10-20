import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const css = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%; margin: 0; overflow: hidden;
      background: #04080f; overscroll-behavior: none;
    }
    body { touch-action: none; }
    canvas {
      display: block; width: 100% !important; height: 100% !important;
      cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none;
      outline: none;
    }
    body.dragging canvas { cursor: grabbing; }
`;

await mkdir('dist', { recursive: true });

await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome92'],
  outfile: 'dist/app.js',
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});

const devHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>月見マート | 雨夜の街角</title>
  <style>${css}</style>
</head>
<body>
  <script src="./dist/app.js"></script>
</body>
</html>
`;
await writeFile('dev.html', devHtml, 'utf8');

const minified = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome92'],
  minify: true,
  legalComments: 'none',
  write: false,
});
const js = minified.outputFiles[0].text;
const finalHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#060b14">
  <title>月見マート | 雨夜の街角</title>
  <style>${css}</style>
</head>
<body>
<script>${js}</script>
</body>
</html>
`;
await writeFile('index.html', finalHtml, 'utf8');
console.log(`Built index.html (${(finalHtml.length / 1024).toFixed(0)} KB)`);
