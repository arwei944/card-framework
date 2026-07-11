/**
 * CircuitBreaker — per-card and global circuit breaker for fault tolerance.
 * @module security/CircuitBreaker
 */

import { EVENT_TYPES } from '../utils/constants.js';
import { DEFAULT_CONFIG } from '../utils/constants.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class CircuitBreaker {
  constructor(options = {}) {
    this.cardFailureThreshold = options.cardFailureThreshold || DEFAULT_CONFIG.CIRCUIT_BREAKER.CARD_FAILURE_THRESHOLD;
    this.globalFailureThreshold = options.globalFailureThreshold || DEFAULT_CONFIG.CIRCUIT_BREAKER.GLOBAL_FAILURE_THRESHOLD;
    this.windowMs = options.windowMs || DEFAULT_CONFIG.CIRCUIT_BREAKER.WINDOW_MS;
    this.resetTimeoutMs = options.resetTimeoutMs || DEFAULT_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS;
    this._eventBus = options.eventBus || null;

    this._cardFailures = new Map();
    this._globalFailures = [];
    this._cardStates = new Map();
    this._globalState = 'closed';
    this._lastGlobalOpen = 0;
    this._safeMode = false;
  }

  _emit(eventName, detail) {
    if (this._eventBus) {
      this._eventBus.emit(eventName, detail);
    }
  }

  recordSuccess(cardId = null) {
    if (cardId) {
      const state = this._cardStates.get(cardId);
      if (state === 'open') {
        this._cardStates.set(cardId, 'closed');
        this._emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { cardId, level: 'card' });
      }
      this._cardFailures.delete(cardId);
    }

    if (this._globalState === 'open' && Date.now() - this._lastGlobalOpen > this.resetTimeoutMs) {
      this._globalState = 'half-open';
    }
  }

  recordFailure(cardId = null) {
    const now = Date.now();

    if (cardId) {
      let failures = this._cardFailures.get(cardId) || [];
      failures = failures.filter(t => now - t < this.windowMs);
      failures.push(now);
      this._cardFailures.set(cardId, failures);

      if (failures.length >= this.cardFailureThreshold) {
        const state = this._cardStates.get(cardId);
        if (state !== 'open') {
          this._cardStates.set(cardId, 'open');
          this._emit(EVENT_TYPES.CIRCUIT_BREAKER_OPENED, { cardId, level: 'card', failureCount: failures.length });
          FeedbackSystem.warn(
            `卡片 ${cardId} 触发熔断`,
            `错误次数: ${failures.length}，将在 ${this.resetTimeoutMs / 1000} 秒后尝试恢复`
          );
        }
      }
    }

    this._globalFailures = this._globalFailures.filter(t => now - t < this.windowMs);
    this._globalFailures.push(now);

    if (this._globalFailures.length >= this.globalFailureThreshold) {
      if (this._globalState !== 'open') {
        this._globalState = 'open';
        this._lastGlobalOpen = now;
        this._safeMode = true;
        this._emit(EVENT_TYPES.CIRCUIT_BREAKER_OPENED, {
          level: 'global',
          failureCount: this._globalFailures.length,
          safeMode: true
        });
        FeedbackSystem.error(
          '全局熔断已触发，进入安全模式',
          `错误次数: ${this._globalFailures.length}，非核心功能将被禁用`,
          '减少操作频率，等待系统自动恢复'
        );
      }
    }
  }

  canExecute(cardId = null) {
    if (this._safeMode) {
      if (Date.now() - this._lastGlobalOpen > this.resetTimeoutMs) {
        this._globalState = 'half-open';
        this._safeMode = false;
        this._emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { level: 'global', recovering: true });
        return true;
      }
      return false;
    }

    if (cardId) {
      const state = this._cardStates.get(cardId);
      if (state === 'open') {
        const failures = this._cardFailures.get(cardId) || [];
        if (failures.length > 0 && Date.now() - failures[failures.length - 1] > this.resetTimeoutMs) {
          this._cardStates.set(cardId, 'half-open');
          return true;
        }
        return false;
      }
    }

    return true;
  }

  execute(fn, cardId = null) {
    if (!this.canExecute(cardId)) {
      throw new Error(cardId ? `卡片 ${cardId} 已熔断` : '全局熔断已触发');
    }

    try {
      const result = fn();
      this.recordSuccess(cardId);
      return result;
    } catch (e) {
      this.recordFailure(cardId);
      throw e;
    }
  }

  getCardState(cardId) {
    return this._cardStates.get(cardId) || 'closed';
  }

  getGlobalState() {
    return this._globalState;
  }

  isSafeMode() {
    return this._safeMode;
  }

  reset(cardId = null) {
    if (cardId) {
      this._cardFailures.delete(cardId);
      this._cardStates.delete(cardId);
      this._emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { cardId, level: 'card', manual: true });
    } else {
      this._globalFailures = [];
      this._globalState = 'closed';
      this._safeMode = false;
      this._emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { level: 'global', manual: true });
    }
  }

  getStats() {
    return {
      globalState: this._globalState,
      safeMode: this._safeMode,
      globalFailureCount: this._globalFailures.length,
      cardCount: this._cardStates.size,
      openCards: Array.from(this._cardStates.entries())
        .filter(([_, state]) => state === 'open')
        .map(([id]) => id)
    };
  }
}
