import { build } from 'esbuild';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const bundleDir = path.join(root, '.portable-build');
const out = path.join(root, 'portable', 'Adaptive-Arena');
await fs.rm(bundleDir, { recursive: true, force: true });
await fs.rm(path.join(root, 'portable'), { recursive: true, force: true });
await fs.mkdir(bundleDir, { recursive: true });
await fs.mkdir(out, { recursive: true });

// Publish only files actually present. Missing original audio must not generate
// hundreds of requests or be replaced with synthetic sounds.
const audioPaths = [];
async function copyAudio(dir, relative = '') {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) await copyAudio(path.join(dir, entry.name), rel);
    else if (/\.(mp3|wav|ogg|m4a|mp4|webm)$/i.test(entry.name)) {
      const destination = path.join(out, 'adaptive-arena-audio', rel);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(path.join(dir, entry.name), destination);
      audioPaths.push('./adaptive-arena-audio/' + rel.split(path.sep).join('/'));
    }
  }
}
await copyAudio(path.join(root, 'public', 'adaptive-arena-audio'));

await build({
  absWorkingDir: root,
  entryPoints: ['src/main.ts'],
  outfile: path.join(bundleDir, 'arena.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
  logLevel: 'info',
  plugins: [{
    name: 'portable-local-audio',
    setup(api) {
      api.onLoad({ filter: /[/\\]audio\.ts$/ }, async args => {
        let contents = await fs.readFile(args.path, 'utf8');
        const original = 'const el = new Audio(path);';
        if (!contents.includes(original)) throw new Error('Audio integration changed: review portable file mapping before packaging.');
        contents = contents.replace(original,
          `const relativePath = path.replace(/^\\//, './');\n      const files: string[] = ${JSON.stringify(audioPaths)};\n      if (!files.includes(relativePath)) return null;\n      const el = new Audio(relativePath);`);
        return { contents, loader: 'ts', resolveDir: path.dirname(args.path) };
      });
    }
  }]
});

const js = (await fs.readFile(path.join(bundleDir, 'arena.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = (await fs.readFile(path.join(bundleDir, 'arena.css'), 'utf8')).replace(/<\/style/gi, '<\\/style');
const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="theme-color" content="#07111f">\n<title>Adaptive Arena</title>\n<style>${css}</style>\n</head>\n<body>\n<div id="app"></div>\n<script>\nglobalThis.clamp = (value, min, max) => Math.max(min, Math.min(max, value));\n${js}\n</script>\n</body>\n</html>\n`;
await fs.writeFile(path.join(out, 'PLAY_ADAPTIVE_ARENA.html'), html);
await fs.writeFile(path.join(out, 'PLAY_WINDOWS.cmd'), [
  '@echo off',
  'setlocal',
  'if not exist "%~dp0PLAY_ADAPTIVE_ARENA.html" (',
  '  echo Game file missing. Extract the entire ZIP before starting the game.',
  '  echo Expected: "%~dp0PLAY_ADAPTIVE_ARENA.html"',
  '  pause',
  '  exit /b 1',
  ')',
  'start "" "%~dp0PLAY_ADAPTIVE_ARENA.html"',
  'exit /b 0',
  ''
].join('\r\n'));

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (const file of sourceFiles) {
  const destination = path.join(out, 'source', file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(path.join(root, file), destination);
}
await fs.writeFile(path.join(out, 'START_HERE.txt'), [
  'ADAPTIVE ARENA - PORTABLE BROWSER BUILD',
  '',
  '1. Extract this entire ZIP into a normal folder.',
  '2. Double-click PLAY_ADAPTIVE_ARENA.html.',
  '   On Windows, PLAY_WINDOWS.cmd opens the same file.',
  '3. Choose Play, then Quickplay to start.',
  '',
  'No npm commands, Node.js, Python, terminal, server or internet are required to play.',
  'Use a desktop browser such as Edge or Chrome.',
  'Do NOT launch source/index.html: that is the developer entrypoint, not the playable build.',
  '',
  'CONTROLS',
  'WASD: move | Mouse: aim | Left mouse: basic attack',
  'C: weapon special | F: character ability | Space: dodge',
  'R: reload | Escape: pause',
  '',
  'SAVE DATA',
  'Progress is stored by the browser. Keep this file in the same folder and use the same browser.',
  'Moving or renaming the file, private browsing, or clearing browser data may hide/remove local saves.',
  'This ZIP is a source/build backup; it is not a cloud backup of browser progression.',
  '',
  'AUDIO',
  audioPaths.length ? `${audioPaths.length} local audio files included.` : 'The original music and sound files were not present in this repository. This package contains no original audio.',
  'Missing sounds are skipped safely. Gameplay remains available.',
  '',
  'BUILD',
  'Based on the Adaptive Arena reconstruction, not the lost original.',
  'This repair changes packaging/local asset paths only; it does not claim to complete all planned features.',
  `Source commit: ${commit}`,
  'The editable project is included under source/.',
  'For development only: open a terminal in source/, run npm install, then npm run dev.',
  ''
].join('\r\n'));
await fs.writeFile(path.join(out, 'BUILD_INFO.json'), JSON.stringify({
  repository: 'nhicksenterprises2025-maker/adaptive-arena',
  commit,
  format: 'standalone-inline-browser-build',
  audioFiles: audioPaths,
  sourceFiles: sourceFiles.length,
  builtAt: new Date().toISOString()
}, null, 2));
console.log(`Portable game written to ${out}`);
