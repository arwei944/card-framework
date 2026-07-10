var path = require('path');
var fs = require('fs');
var VersionManager = require('./version-manager');
var TestRunner = require('./test-runner');
var RollbackManager = require('./rollback-manager');

function EvolutionOrchestrator(config) {
  this.config = config;
  this.versionManager = new VersionManager(config);
  this.testRunner = new TestRunner(config);
  this.rollbackManager = new RollbackManager(config);
  this._projectRoot = path.resolve(__dirname, config.projectRoot || '..');
}

EvolutionOrchestrator.prototype._generateSessionId = function() {
  return 'evo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
};

EvolutionOrchestrator.prototype._applyChanges = function(changes) {
  for (var i = 0; i < changes.length; i++) {
    var change = changes[i];
    var fullPath = path.resolve(this._projectRoot, change.path);
    if (change.type === 'modify' || change.type === 'create') {
      var dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, change.content, 'utf-8');
    } else if (change.type === 'delete') {
      try {
        fs.unlinkSync(fullPath);
      } catch (e) { /* skip if not exists */ }
    }
  }
};

EvolutionOrchestrator.prototype.evolve = function(request) {
  var self = this;
  var action = request.action || {};
  var metrics = request.metrics || {};
  var sessionId = this._generateSessionId();

  var snapshot = this.rollbackManager.createSnapshot(sessionId);

  var changes = this._generateFallbackChanges(action, metrics);

  this._applyChanges(changes);

  return this.testRunner.run().then(function(testResult) {
    if (testResult.passed) {
      var commit = self.versionManager.commit({
        message: 'evolution: ' + (action.reason || 'auto-optimization'),
        sessionId: sessionId,
        changes: changes,
        metrics: metrics
      });
      return { success: true, commit: commit, sessionId: sessionId, changes: changes };
    } else {
      self.rollbackManager.rollback(snapshot);
      return {
        success: false,
        error: 'Tests failed after evolution',
        testResult: testResult,
        sessionId: sessionId
      };
    }
  });
};

EvolutionOrchestrator.prototype._generateFallbackChanges = function(action, metrics) {
  var projectRoot = this._projectRoot;
  var srcPath = path.join(projectRoot, 'src', 'card-framework.js');
  if (!fs.existsSync(srcPath)) return [];

  var content = fs.readFileSync(srcPath, 'utf-8');
  var changes = [];

  if (action.target === 'cardPool' && action.param) {
    content = content.replace(
      new RegExp('(this\\.cardObjectPool = new CardObjectPool\\([^)]*\\))'),
      'this.cardObjectPool = new CardObjectPool({ maxPerType: ' + action.value + ' })'
    );
    changes.push({
      type: 'modify',
      path: 'src/card-framework.js',
      content: content,
      rationale: 'Evolve card pool ' + action.param + ' to ' + action.value
    });
  }

  if (action.target === 'layoutCache' && action.param) {
    content = content.replace(
      new RegExp('(_maxSize: )\\d+'),
      '$1' + action.value
    );
    changes.push({
      type: 'modify',
      path: 'src/card-framework.js',
      content: content,
      rationale: 'Evolve layout cache ' + action.param + ' to ' + action.value
    });
  }

  return changes;
};

module.exports = EvolutionOrchestrator;