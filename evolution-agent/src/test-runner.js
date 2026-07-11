var exec = require('child_process').exec;
var path = require('path');

function TestRunner(config) {
  this.projectRoot = config.projectRoot || '..';
  this.timeout = config.testTimeout || 120000;
  this.npmCommand = config.npmCommand || 'npm';
}

TestRunner.prototype.run = function(extraArgs) {
  var self = this;
  var cwd = path.resolve(__dirname, this.projectRoot);
  var cmd = this.npmCommand + ' test -- --reporter json' + (extraArgs ? ' ' + extraArgs : '');
  return new Promise(function(resolve) {
    exec(cmd, { cwd: cwd, timeout: self.timeout, maxBuffer: 10 * 1024 * 1024 }, function(error, stdout, stderr) {
      var parsed = parse(stdout);
      if (parsed) {
        resolve({
          passed: parsed.failures === 0,
          passing: parsed.passes,
          failing: parsed.failures,
          stdout: stdout.slice(-2000)
        });
        return;
      }
      var pMatch = stdout.match(/(\d+) passing/);
      var fMatch = stdout.match(/(\d+) failing/);
      var passing = pMatch ? parseInt(pMatch[1], 10) : 0;
      var failing = fMatch ? parseInt(fMatch[1], 10) : 0;
      var passed = failing === 0 && (pMatch || !error);
      resolve({ passed: passed, passing: passing, failing: failing, stdout: stdout.slice(-2000), stderr: (stderr || '').slice(-1000) });
    });
  });
};

function parse(stdout) {
  try {
    var start = stdout.indexOf('[');
    if (start === -1) return null;
    var arr = JSON.parse(stdout.slice(start));
    if (!Array.isArray(arr)) return null;
    var stats = null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].stats) { stats = arr[i].stats; break; }
    }
    if (!stats) return null;
    return { passes: stats.passes || 0, failures: stats.failures || 0 };
  } catch (e) {
    return null;
  }
}

module.exports = TestRunner;
