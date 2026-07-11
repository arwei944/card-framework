/**
 * ActionLogger — operation history with undo/redo support.
 * @module evolution/ActionLogger
 */

import { EVENT_TYPES } from '../utils/constants.js';

export class ActionLogger {
  constructor(options = {}) {
    this.maxHistory = options.maxHistory || 100;
    this.enabled = options.enabled !== false;
    this._history = [];
    this._redoStack = [];
    this._listeners = new Set();
    this._eventBus = options.eventBus || null;
  }

  /**
   * Record an operation
   * @param {string} type - operation type (add/update/remove)
   * @param {object} payload - operation data
   */
  record(type, payload) {
    if (!this.enabled) return;

    const action = {
      type,
      timestamp: Date.now(),
      ...payload
    };

    this._history.push(action);

    if (this._history.length > this.maxHistory) {
      this._history.shift();
    }

    this._redoStack = [];
    this._notifyChange();
    return action;
  }

  /**
   * Undo the last operation
   * @param {object} store - Store instance
   * @returns {boolean} success
   */
  undo(store) {
    if (this._history.length === 0) return false;

    const action = this._history.pop();
    this._performUndo(action, store);
    this._redoStack.push(action);

    this._notifyChange();
    return true;
  }

  /**
   * Redo the last undone operation
   * @param {object} store - Store instance
   * @returns {boolean} success
   */
  redo(store) {
    if (this._redoStack.length === 0) return false;

    const action = this._redoStack.pop();
    this._performRedo(action, store);
    this._history.push(action);

    this._notifyChange();
    return true;
  }

  /**
   * Rollback to a specific timestamp
   * @param {number} timestamp - target timestamp
   * @param {object} store - Store instance
   * @returns {boolean} success
   */
  rollback(timestamp, store) {
    const toUndo = this._history.filter(a => a.timestamp > timestamp);
    if (toUndo.length === 0) return false;

    toUndo.reverse().forEach(action => {
      this._performUndo(action, store);
      this._redoStack.push(action);
    });

    this._notifyChange();
    return true;
  }

  getHistory() {
    return this._history.slice();
  }

  clear() {
    this._history = [];
    this._redoStack = [];
    this._notifyChange();
  }

  pause() {
    this.enabled = false;
  }

  resume() {
    this.enabled = true;
  }

  canUndo() {
    return this._history.length > 0;
  }

  canRedo() {
    return this._redoStack.length > 0;
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getStatus() {
    return {
      historyCount: this._history.length,
      redoCount: this._redoStack.length,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      enabled: this.enabled
    };
  }

  _emitError(type, message, error, context) {
    if (this._eventBus) {
      this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
        type,
        message,
        error,
        context,
        timestamp: Date.now()
      });
    }
  }

  _performUndo(action, store) {
    if (!store) return;

    try {
      switch (action.type) {
        case 'addCard':
          if (action.card) {
            store.removeCard(action.card.id);
          }
          break;
        case 'updateCard':
          if (action.cardId && action.previousState) {
            store.updateCard(action.cardId, action.previousState);
          }
          break;
        case 'removeCard':
          if (action.card) {
            store.addCard(action.card);
          }
          break;
        case 'addRelationship':
          if (action.relationship) {
            store.removeRelationship(action.relationship.id);
          }
          break;
        case 'removeRelationship':
          if (action.relationship) {
            store.addRelationship(action.relationship);
          }
          break;
      }
    } catch (e) {
      this._emitError('undo_error', '撤销操作失败: ' + e.message, e, { action });
    }
  }

  _performRedo(action, store) {
    if (!store) return;

    try {
      switch (action.type) {
        case 'addCard':
          if (action.card) {
            store.addCard(action.card);
          }
          break;
        case 'updateCard':
          if (action.cardId && action.newState) {
            store.updateCard(action.cardId, action.newState);
          }
          break;
        case 'removeCard':
          if (action.card) {
            store.removeCard(action.card.id);
          }
          break;
        case 'addRelationship':
          if (action.relationship) {
            store.addRelationship(action.relationship);
          }
          break;
        case 'removeRelationship':
          if (action.relationship) {
            store.removeRelationship(action.relationship.id);
          }
          break;
      }
    } catch (e) {
      this._emitError('redo_error', '重做操作失败: ' + e.message, e, { action });
    }
  }

  _notifyChange() {
    const status = this.getStatus();
    this._listeners.forEach(l => {
      try { l(status); } catch (e) {
        console.warn('[CardFrame] ActionLogger listener error:', e);
      }
    });
  }
}
