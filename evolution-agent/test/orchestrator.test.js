const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EvolutionOrchestrator = require('../src/evolution-orchestrator');

function makeTmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-test-'));
  const cardFile = path.join(root, 'src', 'core', 'CardFrame.js');
  fs.mkdirSync(path.dirname(cardFile), { recursive: true });
  fs.writeFileSync(cardFile,
    "function CardFrame() {\n" +
    "  this.cardObjectPool = new CardObjectPool(options.cardPool || {});\n" +
    "}\n");
  return root;
}

function makeOrchestrator(root, extra) {
  const config = Object.assign({
    projectRoot: root,
    allowedWritePaths: ['src/core/CardFrame.js'],
    dryRun: true,
    llmEndpoint: '',
    llmApiKeyEnv: '__NO_KEY__'
  }, extra || {});
  return new EvolutionOrchestrator(config);
}

test('path allowlist rejects traversal and disallowed files', () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  assert.strictEqual(o._resolveWritePath('../escape.js'), null);
  assert.strictEqual(o._resolveWritePath('src/core/CardFrame.js'), path.join(root, 'src', 'core', 'CardFrame.js'));
  assert.strictEqual(o._resolveWritePath('src/other.js'), null);
});

test('_applyStructuredChanges applies unique find/replace', () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  const file = 'src/core/CardFrame.js';
  const r = o._applyStructuredChanges([{ file, find: 'marker-none', replace: 'X' }]);
  assert.strictEqual(r.errors.length, 1);
  assert.strictEqual(r.applied.length, 0);

  const r2 = o._applyStructuredChanges([{ file, find: 'options.cardPool || {}', replace: 'FIND' }]);
  assert.strictEqual(r2.errors.length, 0);
  assert.strictEqual(r2.applied.length, 1);
  assert.ok(fs.readFileSync(path.join(root, file), 'utf-8').includes('FIND'));
});

test('_applyStructuredChanges rejects ambiguous and disallowed', () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  const file = 'src/core/CardFrame.js';
  const dup = path.join(root, 'src', 'core', 'dup.js');
  fs.writeFileSync(dup, 'AAA AAA');
  o.config.allowedWritePaths.push('src/core/dup.js');
  const r = o._applyStructuredChanges([{ file: 'src/core/dup.js', find: 'AAA', replace: 'B' }]);
  assert.strictEqual(r.errors[0].error.includes('ambiguous'), true);
  const r2 = o._applyStructuredChanges([{ file: 'src/secret.js', find: 'x', replace: 'y' }]);
  assert.strictEqual(r2.errors[0].error, 'write path not allowed');
});

test('_heuristicPatches emits key-value cardPool patch for allowed file', () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  const patches = o._heuristicPatches({ target: 'cardPool', value: 200 });
  assert.strictEqual(patches.length, 1);
  assert.strictEqual(patches[0].file, 'src/core/CardFrame.js');
  assert.ok(patches[0].replace.includes('maxPerType: 200'));
});

test('evolve applies change, runs tests (stubbed), respects dryRun', async () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  o.testRunner.run = () => Promise.resolve({ passed: true, passing: 190, failing: 0 });
  const before = fs.readFileSync(path.join(root, 'src/core/CardFrame.js'), 'utf-8');
  const result = await o.evolve({ action: { target: 'cardPool', value: 200 } });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.dryRun, true);
  assert.ok(result.method.startsWith('heuristic'));
  const after = fs.readFileSync(path.join(root, 'src/core/CardFrame.js'), 'utf-8');
  assert.strictEqual(before, after);
});

test('evolve rolls back when tests fail', async () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root);
  o.testRunner.run = () => Promise.resolve({ passed: false, passing: 0, failing: 1 });
  const before = fs.readFileSync(path.join(root, 'src/core/CardFrame.js'), 'utf-8');
  const result = await o.evolve({ action: { target: 'cardPool', value: 200 } });
  assert.strictEqual(result.success, false);
  const after = fs.readFileSync(path.join(root, 'src/core/CardFrame.js'), 'utf-8');
  assert.strictEqual(before, after);
});

test('capabilities advertise heuristic and dryRun', () => {
  const root = makeTmpProject();
  const o = makeOrchestrator(root, { dryRun: false });
  const caps = o.getCapabilities();
  assert.strictEqual(caps.heuristic, true);
  assert.strictEqual(caps.llm, false);
  assert.strictEqual(caps.dryRun, false);
  assert.deepStrictEqual(caps.allowedWritePaths, ['src/core/CardFrame.js']);
});
