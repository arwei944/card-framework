# Task 9: Agent 端 — RollbackManager 模块

**Files:**
- Create: `evolution-agent/src/rollback-manager.js`

## Step 1: 创建 rollback-manager.js

```javascript
var execSync = require('child_process').execSync;
var fs = require('fs');
var path = require('path');

function RollbackManager(config) {
  this.projectRoot = config.projectRoot || '..';
  this.maxSnapshots = config.maxSnapshots || 20;
  this._cwd = path.resolve(__dirname, this.projectRoot);
  this.snapshotDir = path.resolve(__dirname, 'snapshots');
}

RollbackManager.prototype._git = function(args) {
  return execSync('git ' + args, { cwd: this._cwd, encoding: 'utf-8' }).trim();
};

RollbackManager.prototype.createSnapshot = function(sessionId) {
  var headHash;
  var stashRef;
  try {
    headHash = this._git('rev-parse HEAD');
  } catch (e) {
    headHash = 'no-commits';
  }
  try {
    stashRef = this._git('stash create');
  } catch (e) {
    stashRef = '';
  }

  var snapshot = {
    sessionId: sessionId,
    headHash: headHash,
    stashRef: stashRef,
    timestamp: Date.now(),
    changedFiles: this._getChangedFiles()
  };

  if (!fs.existsSync(this.snapshotDir)) {
    fs.mkdirSync(this.snapshotDir, { recursive: true });
  }
  var metaPath = path.join(this.snapshotDir, sessionId + '.json');
  fs.writeFileSync(metaPath, JSON.stringify(snapshot, null, 2));

  this._cleanupOldSnapshots();
  return snapshot;
};

RollbackManager.prototype.rollback = function(snapshot) {
  if (snapshot.stashRef) {
    try {
      this._git('stash apply ' + snapshot.stashRef);
    } catch (e) { /* ignore stash apply failure */ }
  } else {
    this._git('checkout -- .');
  }
  try {
    this._git('reset --hard ' + snapshot.headHash);
  } catch (e) {
    this._git('checkout --orphan temp-branch');
    this._git('commit -m "rollback to snapshot ' + snapshot.sessionId + '"');
  }
  return { success: true, sessionId: snapshot.sessionId };
};

RollbackManager.prototype.listSnapshots = function() {
  if (!fs.existsSync(this.snapshotDir)) return [];
  var files = fs.readdirSync(this.snapshotDir);
  var snapshots = [];
  for (var i = 0; i < files.length; i++) {
    if (files[i].endsWith('.json')) {
      var content = fs.readFileSync(path.join(this.snapshotDir, files[i]), 'utf-8');
      snapshots.push(JSON.parse(content));
    }
  }
  snapshots.sort(function(a, b) { return b.timestamp - a.timestamp; });
  return snapshots;
};

RollbackManager.prototype.rollbackTo = function(sessionId) {
  var metaPath = path.join(this.snapshotDir, sessionId + '.json');
  if (!fs.existsSync(metaPath)) {
    return { success: false, error: 'Snapshot not found: ' + sessionId };
  }
  var content = fs.readFileSync(metaPath, 'utf-8');
  var snapshot = JSON.parse(content);
  return this.rollback(snapshot);
};

RollbackManager.prototype._getChangedFiles = function() {
  try {
    var result = this._git('diff --name-only HEAD');
    return result ? result.split('\n').filter(function(l) { return l.length > 0; }) : [];
  } catch (e) {
    return [];
  }
};

RollbackManager.prototype._cleanupOldSnapshots = function() {
  if (!fs.existsSync(this.snapshotDir)) return;
  var files = fs.readdirSync(this.snapshotDir);
  var jsonFiles = files.filter(function(f) { return f.endsWith('.json'); });
  if (jsonFiles.length <= this.maxSnapshots) return;

  var sorted = jsonFiles.map(function(f) {
    var stat = fs.statSync(path.join(this.snapshotDir, f));
    return { name: f, mtime: stat.mtime };
  }, this);
  sorted.sort(function(a, b) { return a.mtime - b.mtime; });

  var toDelete = sorted.slice(0, sorted.length - this.maxSnapshots);
  for (var i = 0; i < toDelete.length; i++) {
    try {
      fs.unlinkSync(path.join(this.snapshotDir, toDelete[i].name));
    } catch (e) { /* skip */ }
  }
};

module.exports = RollbackManager;
```

## Step 2: 提交
```bash
git add evolution-agent/src/rollback-manager.js
git commit -m "feat: add RollbackManager module for snapshot and rollback"
```