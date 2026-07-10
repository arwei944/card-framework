var exec = require('child_process').exec;
var path = require('path');

function TestRunner(config) {
  this.projectRoot = config.projectRoot || '..';
  this.timeout = config.testTimeout || 120000;
}

TestRunner.prototype.run = function(extraArgs) {
  var self = this;
  var cwd = path.resolve(__dirname, this.projectRoot);
  var cmd = 'npm test' + (extraArgs ? ' ' + extraArgs : '');
  return new Promise(function(resolve) {
    exec(cmd, { cwd: cwd, timeout: self.timeout }, function(error, stdout, stderr) {
      if (error && !stdout.match(/(\d+) failing/)) {
        resolve({
          passed: false,
          error: error.message,
          stdout: stdout.slice(-2000),
          stderr: stderr.slice(-2000)
        });
      } else {
        var passing = 0;
        var failing = 0;
        var pMatch = stdout.match(/(\d+) passing/);
        var fMatch = stdout.match(/(\d+) failing/);
        if (pMatch) passing = parseInt(pMatch[1]);
        if (fMatch) failing = parseInt(fMatch[1]);
        resolve({
          passed: failing === 0,
          passing: passing,
          failing: failing,
          stdout: stdout.slice(-2000)
        });
      }
    });
  });
};

module.exports = TestRunner;