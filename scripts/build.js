/**
 * CardFrame Build Script (esbuild)
 *
 * Replaces the old regex-based build. Uses esbuild to bundle ES Modules
 * from src/index.js into multiple output formats.
 *
 * Outputs:
 *   dist/card-framework.js       — IIFE (for <script> tags, sets window.CardFrame)
 *   dist/card-framework.min.js   — IIFE minified with source map
 *   dist/card-framework.esm.js   — ES Module (for bundlers)
 *   dist/card-framework.esm.min.js — ESM minified with source map
 *   dist/card-framework.cjs.js   — CommonJS (for Node.js require)
 *   dist/card-framework.css      — Stylesheet (copied from src/)
 *
 * Constraints: 4.1 (esbuild), 4.3 (IIFE+ESM+CJS), 1.2 (zero runtime deps),
 *              2.2 (backward compat — window.CardFrame must work)
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'index.js');
const DIST = path.join(ROOT, 'dist');
const CSS_SRC = path.join(ROOT, 'src', 'card-framework.css');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyCSS() {
  if (fs.existsSync(CSS_SRC)) {
    fs.copyFileSync(CSS_SRC, path.join(DIST, 'card-framework.css'));
    console.log('  ✓ card-framework.css');
  } else {
    console.warn('  ⚠ CSS source not found:', CSS_SRC);
  }
}

async function build() {
  console.log('CardFrame build starting...');
  console.log('  Entry:', path.relative(ROOT, ENTRY));
  ensureDir(DIST);

  // ─── 1. IIFE (full) ────────────────────────────────────
  // For <script> tags. Sets window.CardFrame as global.
  console.log('\n[1/6] IIFE (full)...');
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    globalName: 'CardFrame',
    target: ['es2018'],
    outfile: path.join(DIST, 'card-framework.js'),
    platform: 'browser',
    legalComments: 'none',
    banner: {
      js: '/* CardFrame v1.0.0 | MIT License | https://github.com/cardframe */',
    },
  });
  console.log('  ✓ card-framework.js');

  // ─── 2. IIFE (minified + sourcemap) ────────────────────
  console.log('[2/6] IIFE (minified)...');
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'iife',
    globalName: 'CardFrame',
    target: ['es2018'],
    outfile: path.join(DIST, 'card-framework.min.js'),
    platform: 'browser',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
  });
  console.log('  ✓ card-framework.min.js + .map');

  // ─── 3. ESM (full) ─────────────────────────────────────
  // For bundlers (webpack, rollup, vite) and <script type="module">
  console.log('[3/6] ESM (full)...');
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    target: ['es2018'],
    outfile: path.join(DIST, 'card-framework.esm.js'),
    platform: 'browser',
    legalComments: 'none',
    banner: {
      js: '/* CardFrame v1.0.0 | MIT License | ESM build */',
    },
  });
  console.log('  ✓ card-framework.esm.js');

  // ─── 4. ESM (minified + sourcemap) ─────────────────────
  console.log('[4/6] ESM (minified)...');
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    target: ['es2018'],
    outfile: path.join(DIST, 'card-framework.esm.min.js'),
    platform: 'browser',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
  });
  console.log('  ✓ card-framework.esm.min.js + .map');

  // ─── 5. CJS (for Node.js require) ──────────────────────
  console.log('[5/6] CJS...');
  await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'cjs',
    target: ['es2018'],
    outfile: path.join(DIST, 'card-framework.cjs.js'),
    platform: 'browser',
    legalComments: 'none',
    banner: {
      js: '/* CardFrame v1.0.0 | MIT License | CJS build */',
    },
  });
  console.log('  ✓ card-framework.cjs.js');

  // ─── 6. Copy CSS ───────────────────────────────────────
  console.log('[6/6] CSS...');
  copyCSS();

  // ─── Summary ───────────────────────────────────────────
  const files = fs.readdirSync(DIST).filter(f => !f.startsWith('.'));
  console.log('\nBuild complete! Output files in dist/:');
  files.forEach(f => {
    const stat = fs.statSync(path.join(DIST, f));
    const size = (stat.size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(35)} ${size.padStart(8)} KB`);
  });
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
