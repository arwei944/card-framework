(function(window) {
  'use strict';

  class E2ETestRunner {
    constructor(options = {}) {
      this.tests = [];
      this.currentSuite = '';
      this.results = {
        passed: 0,
        failed: 0,
        total: 0,
        suites: []
      };
      this.options = {
        outputToConsole: true,
        outputToPage: true,
        containerId: 'test-results',
        ...options
      };
      this._currentSuiteTests = [];
    }

    describe(suiteName, fn) {
      this.currentSuite = suiteName;
      this._currentSuiteTests = [];
      fn();
      this.results.suites.push({
        name: suiteName,
        tests: [...this._currentSuiteTests]
      });
      this._currentSuiteTests = [];
      this.currentSuite = '';
    }

    it(testName, fn) {
      const test = {
        suite: this.currentSuite,
        name: testName,
        fn: fn,
        status: 'pending'
      };
      this.tests.push(test);
      this._currentSuiteTests.push(test);
    }

    expect(actual) {
      return {
        toBe: (expected) => {
          if (actual !== expected) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
          }
        },
        toEqual: (expected) => {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
          }
        },
        toBeTruthy: () => {
          if (!actual) {
            throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
          }
        },
        toBeFalsy: () => {
          if (actual) {
            throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
          }
        },
        toBeGreaterThan: (expected) => {
          if (actual <= expected) {
            throw new Error(`Expected ${actual} to be greater than ${expected}`);
          }
        },
        toBeLessThan: (expected) => {
          if (actual >= expected) {
            throw new Error(`Expected ${actual} to be less than ${expected}`);
          }
        },
        toContain: (expected) => {
          if (Array.isArray(actual) || typeof actual === 'string') {
            if (!actual.includes(expected)) {
              throw new Error(`Expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`);
            }
          } else {
            throw new Error('toContain can only be used on arrays or strings');
          }
        },
        toBeNull: () => {
          if (actual !== null) {
            throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
          }
        },
        toBeUndefined: () => {
          if (actual !== undefined) {
            throw new Error(`Expected undefined but got ${JSON.stringify(actual)}`);
          }
        },
        toBeDefined: () => {
          if (actual === undefined) {
            throw new Error('Expected value to be defined');
          }
        },
        toBeInstanceOf: (constructor) => {
          if (!(actual instanceof constructor)) {
            throw new Error(`Expected instance of ${constructor.name}`);
          }
        },
        toHaveLength: (expected) => {
          if (actual.length !== expected) {
            throw new Error(`Expected length ${expected} but got ${actual.length}`);
          }
        },
        toThrow: (expectedMessage) => {
          let threw = false;
          let errorMessage = '';
          try {
            actual();
          } catch (e) {
            threw = true;
            errorMessage = e.message;
          }
          if (!threw) {
            throw new Error('Expected function to throw');
          }
          if (expectedMessage && !errorMessage.includes(expectedMessage)) {
            throw new Error(`Expected error message to contain "${expectedMessage}" but got "${errorMessage}"`);
          }
        }
      };
    }

    async run() {
      this.results = {
        passed: 0,
        failed: 0,
        total: this.tests.length,
        suites: this.results.suites.map(s => ({ ...s, tests: s.tests.map(t => ({ ...t })) }))
      };

      this._printHeader();

      for (const test of this.tests) {
        await this._runTest(test);
      }

      this._printSummary();
      this._renderResults();

      return this.results;
    }

    async _runTest(test) {
      try {
        await test.fn();
        test.status = 'passed';
        test.error = null;
        this.results.passed++;
        this._printTestResult(test, true);
      } catch (error) {
        test.status = 'failed';
        test.error = error;
        this.results.failed++;
        this._printTestResult(test, false, error);
      }
    }

    _printHeader() {
      if (this.options.outputToConsole) {
        console.log('\n========================================');
        console.log('  E2E Test Runner');
        console.log('========================================\n');
      }
    }

    _printTestResult(test, passed, error = null) {
      if (!this.options.outputToConsole) return;

      const status = passed ? '✓' : '✗';
      const suite = test.suite ? `[${test.suite}] ` : '';
      
      if (passed) {
        console.log(`  ${status} ${suite}${test.name}`);
      } else {
        console.error(`  ${status} ${suite}${test.name}`);
        if (error) {
          console.error(`    ${error.message}`);
        }
      }
    }

    _printSummary() {
      if (!this.options.outputToConsole) return;

      const { passed, failed, total } = this.results;
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

      console.log('\n========================================');
      console.log(`  总计: ${total} 个测试`);
      console.log(`  通过: ${passed}`);
      console.log(`  失败: ${failed}`);
      console.log(`  通过率: ${passRate}%`);
      console.log('========================================\n');
    }

    _renderResults() {
      if (!this.options.outputToPage) return;

      const container = document.getElementById(this.options.containerId);
      if (!container) return;

      const { passed, failed, total, suites } = this.results;
      const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
      const allPassed = failed === 0;

      let html = `
        <div class="test-summary ${allPassed ? 'all-passed' : 'has-failures'}">
          <h2>测试结果总结</h2>
          <div class="summary-stats">
            <div class="stat total">
              <span class="stat-label">总计</span>
              <span class="stat-value">${total}</span>
            </div>
            <div class="stat passed">
              <span class="stat-label">通过</span>
              <span class="stat-value">${passed}</span>
            </div>
            <div class="stat failed">
              <span class="stat-label">失败</span>
              <span class="stat-value">${failed}</span>
            </div>
            <div class="stat rate">
              <span class="stat-label">通过率</span>
              <span class="stat-value">${passRate}%</span>
            </div>
          </div>
        </div>
      `;

      suites.forEach(suite => {
        const suitePassed = suite.tests.filter(t => t.status === 'passed').length;
        const suiteTotal = suite.tests.length;
        const suiteAllPassed = suitePassed === suiteTotal;

        html += `
          <div class="test-suite ${suiteAllPassed ? 'suite-passed' : 'suite-failed'}">
            <h3>
              <span class="suite-icon">${suiteAllPassed ? '✓' : '✗'}</span>
              ${suite.name}
              <span class="suite-count">(${suitePassed}/${suiteTotal})</span>
            </h3>
            <div class="test-list">
        `;

        suite.tests.forEach(test => {
          const testPassed = test.status === 'passed';
          html += `
            <div class="test-item ${testPassed ? 'test-passed' : 'test-failed'}">
              <span class="test-icon">${testPassed ? '✓' : '✗'}</span>
              <span class="test-name">${test.name}</span>
              ${!testPassed && test.error ? `<div class="test-error">${this._escapeHtml(test.error.message)}</div>` : ''}
            </div>
          `;
        });

        html += `
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      this._addStyles(container);
    }

    _escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    _addStyles(container) {
      const styleId = 'e2e-test-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #${this.options.containerId} {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .test-summary {
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .test-summary.all-passed {
          background: #f0fdf4;
          border: 1px solid #86efac;
        }

        .test-summary.has-failures {
          background: #fef2f2;
          border: 1px solid #fca5a5;
        }

        .test-summary h2 {
          margin: 0 0 16px 0;
          font-size: 20px;
          color: #1a1a1a;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .stat {
          text-align: center;
          padding: 12px;
          background: white;
          border-radius: 6px;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: bold;
        }

        .stat.passed .stat-value { color: #22c55e; }
        .stat.failed .stat-value { color: #ef4444; }
        .stat.total .stat-value { color: #3b82f6; }
        .stat.rate .stat-value { color: #8b5cf6; }

        .test-suite {
          margin-bottom: 16px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #e5e5e5;
        }

        .test-suite.suite-passed { border-color: #86efac; }
        .test-suite.suite-failed { border-color: #fca5a5; }

        .test-suite h3 {
          margin: 0;
          padding: 12px 16px;
          background: #f9fafb;
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .suite-icon {
          font-weight: bold;
        }

        .suite-passed .suite-icon { color: #22c55e; }
        .suite-failed .suite-icon { color: #ef4444; }

        .suite-count {
          margin-left: auto;
          font-size: 14px;
          color: #666;
          font-weight: normal;
        }

        .test-list {
          padding: 8px 0;
        }

        .test-item {
          padding: 8px 16px;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 14px;
        }

        .test-icon {
          font-weight: bold;
          width: 20px;
          flex-shrink: 0;
        }

        .test-passed .test-icon { color: #22c55e; }
        .test-failed .test-icon { color: #ef4444; }

        .test-name {
          flex: 1;
        }

        .test-failed .test-name {
          color: #dc2626;
        }

        .test-error {
          margin-top: 4px;
          padding: 8px;
          background: #fef2f2;
          border-radius: 4px;
          font-size: 12px;
          color: #991b1b;
          font-family: monospace;
          grid-column: 2 / -1;
          width: 100%;
        }

        .test-item:has(.test-error) {
          flex-wrap: wrap;
        }
      `;

      document.head.appendChild(style);
    }

    reset() {
      this.tests = [];
      this.results = {
        passed: 0,
        failed: 0,
        total: 0,
        suites: []
      };
      this.currentSuite = '';
      this._currentSuiteTests = [];
    }
  }

  window.E2ETestRunner = E2ETestRunner;

  const runner = new E2ETestRunner();
  window.describe = (name, fn) => runner.describe(name, fn);
  window.it = (name, fn) => runner.it(name, fn);
  window.expect = (actual) => runner.expect(actual);
  window.runE2ETests = () => runner.run();
  window.e2eTestRunner = runner;

})(window);
