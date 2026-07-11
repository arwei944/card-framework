/**
 * Performance monitoring utilities.
 * @module perf/Perf
 */

export const Perf = {
  _marks: new Map(),
  _measures: [],
  _stats: {
    renderCount: 0,
    totalRenderTime: 0,
    avgRenderTime: 0,
    maxRenderTime: 0,
    minRenderTime: Infinity,
    cardCount: 0,
    lastRenderTime: 0
  },

  mark(name) {
    this._marks.set(name, performance.now());
  },

  measure(name, startMark, endMark) {
    const start = this._marks.get(startMark);
    const end = this._marks.get(endMark);
    if (start === undefined || end === undefined) return null;
    const duration = end - start;
    this._measures.push({ name, duration, timestamp: Date.now() });
    if (this._measures.length > 100) {
      this._measures.shift();
    }
    return duration;
  },

  recordRender(duration, cardCount) {
    this._stats.renderCount++;
    this._stats.totalRenderTime += duration;
    this._stats.avgRenderTime = this._stats.totalRenderTime / this._stats.renderCount;
    this._stats.maxRenderTime = Math.max(this._stats.maxRenderTime, duration);
    this._stats.minRenderTime = Math.min(this._stats.minRenderTime, duration);
    this._stats.cardCount = cardCount;
    this._stats.lastRenderTime = duration;
  },

  getStats() {
    return {
      ...this._stats,
      minRenderTime: this._stats.minRenderTime === Infinity ? 0 : this._stats.minRenderTime,
      recentMeasures: this._measures.slice(-20)
    };
  },

  reset() {
    this._marks.clear();
    this._measures = [];
    this._stats = {
      renderCount: 0,
      totalRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
      cardCount: 0,
      lastRenderTime: 0
    };
  }
};
