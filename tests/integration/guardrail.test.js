/**
 * Guardrail tests — hard constraint system for AI Agent integration
 *
 * Tests four escape-usage rules (R1-R4), whitelist, config options,
 * and lifecycle (scan / observe / disconnect / destroy).
 */

const assert = require('assert');
const { createFrame, createContainer, cleanupFrame } = require('../helpers');
const { CardFrame } = require('../../dist/card-framework.cjs.js');

describe('Guardrail', function () {
  let frame, container;

  afterEach(function () {
    if (frame && !frame._destroyed) {
      frame.destroy();
    }
    frame = null;
    container = null;
  });

  describe('R1: 非卡片元素检测', function () {
    it('容器内插入 <div> 应触发 warn 违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const div = document.createElement('div');
      div.className = 'card';
      container.appendChild(div);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.ok(r1.length >= 1, '应检测到 R1 违规');
      assert.strictEqual(r1[0].severity, 'warn');
      assert.ok(r1[0].suggestion.includes('cf-card'));
    });

    it('容器内插入 <section> 应触发 warn', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const section = document.createElement('section');
      container.appendChild(section);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.ok(r1.length >= 1);
    });
  });

  describe('R2: 逃逸 CSS 框架检测', function () {
    it('容器内元素带 Tailwind class 应触发 info', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, level: 'info', onViolation: v => violations.push(v) }
      }));

      const div = document.createElement('div');
      div.className = 'flex p-4 bg-blue-500';
      container.appendChild(div);

      const r2 = violations.filter(v => v.rule === 'R2');
      assert.ok(r2.length >= 1);
      assert.ok(r2[0].message.includes('tailwind'));
    });

    it('excludedFrameworks 配置应跳过指定框架', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: {
          testMode: true,
          level: 'info',
          excludedFrameworks: ['tailwind'],
          onViolation: v => violations.push(v)
        }
      }));

      const div = document.createElement('div');
      div.className = 'flex p-4';
      container.appendChild(div);

      const r2 = violations.filter(v => v.rule === 'R2' && v.message.includes('tailwind'));
      assert.strictEqual(r2.length, 0, 'excludedFrameworks 应跳过 Tailwind 检测');
    });
  });

  describe('R3: 直接 DOM 操作检测', function () {
    it('container.appendChild(div) 应触发 R1', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const div = document.createElement('div');
      container.appendChild(div);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.ok(r1.length >= 1, 'appendChild 插入 div 应触发 R1');
    });

    it('设置 container.innerHTML 应触发 R1', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      container.innerHTML = '<div class="card">test</div>';

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.ok(r1.length >= 1, 'innerHTML 设置 div 应触发 R1');
    });
  });

  describe('白名单', function () {
    it('<cf-card> 不应触发违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const card = document.createElement('cf-card');
      card.setAttribute('type', 'text');
      container.appendChild(card);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.strictEqual(r1.length, 0, 'cf-card 不应触发 R1');
    });

    it('<template> 不应触发违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const tpl = document.createElement('template');
      container.appendChild(tpl);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.strictEqual(r1.length, 0, 'template 不应触发 R1');
    });

    it('注释节点不应触发违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      const comment = document.createComment('this is a comment');
      container.appendChild(comment);

      const r1 = violations.filter(v => v.rule === 'R1');
      assert.strictEqual(r1.length, 0, '注释不应触发 R1');
    });
  });

  describe('配置选项', function () {
    it('guardrail: false 应完全关闭检测', function () {
      ({ frame, container } = createFrame({ guardrail: false }));

      assert.strictEqual(frame.guardrail, undefined, 'guardrail 应未初始化');

      const div = document.createElement('div');
      container.appendChild(div);
      // 无 guardrail 实例可查询，测试通过即表示不报错
    });

    it('testMode 不输出 console 但仍记录违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: {
          testMode: true,
          onViolation: v => violations.push(v)
        }
      }));

      const div = document.createElement('div');
      container.appendChild(div);

      assert.ok(violations.length >= 1, 'testMode 仍应记录违规');
    });

    it('onViolation 回调应被正确调用', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: {
          testMode: true,
          onViolation: v => violations.push(v)
        }
      }));

      const div = document.createElement('div');
      container.appendChild(div);

      assert.ok(violations.length >= 1);
      assert.ok('rule' in violations[0]);
      assert.ok('severity' in violations[0]);
      assert.ok('message' in violations[0]);
      assert.ok('suggestion' in violations[0]);
      assert.ok('timestamp' in violations[0]);
    });

    it('level: "error" 仍记录所有违规', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: {
          testMode: true,
          level: 'error',
          onViolation: v => violations.push(v)
        }
      }));

      const div = document.createElement('div');
      div.className = 'flex p-4';
      container.appendChild(div);

      const stats = frame.guardrail.getStats();
      assert.ok(stats.total > 0, '违规应被记录');
    });
  });

  describe('getStats()', function () {
    it('应返回正确的统计信息', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, level: 'info', onViolation: v => violations.push(v) }
      }));

      const div = document.createElement('div');
      div.className = 'flex p-4';
      container.appendChild(div);

      const stats = frame.guardrail.getStats();
      assert.ok(stats.total > 0);
      assert.ok('byRule' in stats);
      assert.ok('bySeverity' in stats);
      assert.strictEqual(stats.enabled, true);
      assert.strictEqual(stats.level, 'info');
    });
  });

  describe('生命周期', function () {
    it('disconnect 后应停止检测', function () {
      const violations = [];
      ({ frame, container } = createFrame({
        guardrail: { testMode: true, onViolation: v => violations.push(v) }
      }));

      frame.guardrail.disconnect();

      const beforeCount = violations.length;
      const div = document.createElement('div');
      container.appendChild(div);

      assert.strictEqual(violations.length, beforeCount, 'disconnect 后不应有新违规');
    });

    it('destroy 后应清理资源', function () {
      ({ frame, container } = createFrame({
        guardrail: { testMode: true }
      }));

      assert.ok(frame.guardrail);
      frame.destroy();
      frame = null; // 防止 afterEach 再次 destroy

      // destroy 后 guardrail 应为 null
      // (frame 已被置 null，这里仅验证 destroy 不抛错)
    });
  });

  describe('CardFrame.Guardrail 静态属性', function () {
    it('CardFrame.Guardrail 应为构造器', function () {
      assert.ok('Guardrail' in CardFrame);
      assert.strictEqual(typeof CardFrame.Guardrail, 'function');
    });
  });
});
