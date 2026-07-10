var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

function VersionManager(config) {
  this.projectRoot = config.projectRoot || '..';
  this.branch = config.branch || 'main';
  this.evolutionBranch = config.evolutionBranch || 'evolution';
  this._cwd = path.resolve(__dirname, this.projectRoot);
}

VersionManager.prototype._git = function(args) {
  return execSync('git ' + args, { cwd: this._cwd, encoding: 'utf-8' }).trim();
};

VersionManager.prototype.ensureEvolutionBranch = function() {
  var branches = this._git('branch --list');
  if (branches.indexOf(this.evolutionBranch) === -1) {
    this._git('checkout -b ' + this.evolutionBranch);
  } else {
    this._git('checkout ' + this.evolutionBranch);
  }
};

VersionManager.prototype.commit = function(evolutionData) {
  var message = evolutionData.message || 'evolution: automated change';
  var sessionId = evolutionData.sessionId;
  var changes = evolutionData.changes || [];
  var metrics = evolutionData.metrics || {};

  this.ensureEvolutionBranch();

  for (var i = 0; i < changes.length; i++) {
    try {
      this._git('add "' + changes[i].path + '"');
    } catch (e) { /* skip unstaged changes */ }
  }

  var metaDir = path.resolve(this._cwd, '.evolution-meta');
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }
  var metaFile = path.join(metaDir, sessionId + '.json');
  fs.writeFileSync(metaFile, JSON.stringify({
    sessionId: sessionId,
    message: message,
    metrics: metrics,
    changes: changes.map(function(c) { return c.path; }),
    timestamp: Date.now()
  }, null, 2));
  this._git('add ".evolution-meta/' + sessionId + '.json"');

  var commitMsg = message + '\n\nEvolution-Session: ' + sessionId
    + '\nMetrics: ' + JSON.stringify(metrics)
    + '\nChanges: ' + changes.length + ' file(s)';
  this._git('commit -m "' + commitMsg.replace(/"/g, '\\"') + '"');

  var hash = this._git('rev-parse HEAD');
  return { hash: hash, branch: this.evolutionBranch, sessionId: sessionId };
};

VersionManager.prototype.getEvolutionLog = function() {
  try {
    var log = this._git('log ' + this.evolutionBranch + ' --oneline --grep="evolution:"');
    return log.split('\n').filter(function(l) { return l.length > 0; });
  } catch (e) {
    return [];
  }
};

VersionManager.prototype.push = function() {
  this._git('push origin ' + this.evolutionBranch);
};

VersionManager.prototype.mergeToMain = function() {
  this._git('checkout ' + this.branch);
  this._git('merge ' + this.evolutionBranch + ' --no-ff');
  this._git('push origin ' + this.branch);
};

module.exports = VersionManager;