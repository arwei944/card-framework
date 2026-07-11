/**
 * PerfPanel — real-time FPS and performance monitoring overlay.
 * @module evolution/PerfPanel
 */

import { Perf } from '../perf/Perf.js';

export class PerfPanel {
  constructor() {
    this._enabled = false;
    this._container = null;
    this._rafId = null;
    this._frameCount = 0;
    this._lastTime = 0;
    this._fps = 60;
    this._domStats = { cards: 0, relationships: 0 };
  }

  enable(container) {
    this._enabled = true;
    this._container = container;
    if (container) {
      this._createPanel();
      this._startMonitoring();
    }
  }

  disable() {
    this._enabled = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._container) {
      const panel = this._container.querySelector('.cf-perf-panel');
      if (panel) panel.remove();
    }
  }

  _createPanel() {
    const panel = document.createElement('div');
    panel.className = 'cf-perf-panel';
    panel.innerHTML = `
      <div class="cf-perf-header">📊 性能监控</div>
      <div class="cf-perf-metrics">
        <div><span class="cf-perf-label">FPS:</span> <span class="cf-perf-fps">--</span></div>
        <div><span class="cf-perf-label">渲染:</span> <span class="cf-perf-render">--</span>ms</div>
        <div><span class="cf-perf-label">卡片:</span> <span class="cf-perf-cards">--</span></div>
        <div><span class="cf-perf-label">关系:</span> <span class="cf-perf-rels">--</span></div>
        <div><span class="cf-perf-label">内存:</span> <span class="cf-perf-mem">--</span></div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      .cf-perf-panel { position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.85); color: #fff; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; z-index: 10000; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
      .cf-perf-header { font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px; }
      .cf-perf-metrics > div { margin: 4px 0; display: flex; justify-content: space-between; }
      .cf-perf-label { color: #aaa; }
      .cf-perf-fps { color: #4ade80; }
      .cf-perf-fps.low { color: #ef4444; }
      .cf-perf-fps.medium { color: #f59e0b; }
    `;
    document.head.appendChild(style);
    this._container.appendChild(panel);
    this._panelEl = panel;
  }

  _startMonitoring() {
    const loop = (time) => {
      if (!this._enabled) return;
      this._frameCount++;
      if (time - this._lastTime >= 1000) {
        this._fps = Math.round(this._frameCount * 1000 / (time - this._lastTime));
        this._frameCount = 0;
        this._lastTime = time;
        this._updateDisplay();
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _updateDisplay() {
    if (!this._panelEl) return;
    const fpsEl = this._panelEl.querySelector('.cf-perf-fps');
    if (fpsEl) {
      fpsEl.textContent = this._fps;
      fpsEl.className = 'cf-perf-fps' + (this._fps < 30 ? ' low' : this._fps < 50 ? ' medium' : '');
    }
    const perfStats = Perf.getStats();
    const renderEl = this._panelEl.querySelector('.cf-perf-render');
    if (renderEl) renderEl.textContent = perfStats.avgTime.toFixed(1);
    const memEl = this._panelEl.querySelector('.cf-perf-mem');
    if (memEl && performance && performance.memory) {
      memEl.textContent = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB';
    }
  }

  updateDOMStats(cards, relationships) {
    this._domStats = { cards, relationships };
    if (this._panelEl) {
      const cardsEl = this._panelEl.querySelector('.cf-perf-cards');
      const relsEl = this._panelEl.querySelector('.cf-perf-rels');
      if (cardsEl) cardsEl.textContent = cards;
      if (relsEl) relsEl.textContent = relationships;
    }
  }

  isEnabled() {
    return this._enabled;
  }
}
