/**
 * Store — central data store for cards and relationships.
 * @module core/Store
 */

import { QueryIndex } from '../perf/QueryIndex.js';
import { Utils } from '../utils/Utils.js';
import { EVENT_TYPES } from '../utils/constants.js';

export class Store {
  constructor(eventBus = null) {
    this.cards = new Map();
    this.relationships = new Map();
    this.listeners = new Set();
    this._index = new QueryIndex();
    this._pool = null;
    this._eventBus = eventBus;
    this._relIndex = new Map();
    this._notifyTimer = null;
    this._snapshotCache = new Map();
  }

  _deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      this._deepFreeze(obj[key]);
    }
    return obj;
  }

  _snapshot(card) {
    if (!card) return card;
    const cached = this._snapshotCache.get(card.id);
    if (cached && cached.master === card) return cached.frozen;
    const frozen = this._deepFreeze(Utils.deepClone(card));
    this._snapshotCache.set(card.id, { master: card, frozen });
    return frozen;
  }

  _invalidateSnapshot(id) {
    this._snapshotCache.delete(id);
  }

  notifyDebounced() {
    if (this._notifyTimer) return;
    const self = this;
    this._notifyTimer = setTimeout(() => {
      self._notifyTimer = null;
      self.notify();
    }, 16);
  }

  _indexRel(rel) {
    [rel.sourceId, rel.targetId].forEach(id => {
      if (!this._relIndex.has(id)) this._relIndex.set(id, new Set());
      this._relIndex.get(id).add(rel.id);
    });
  }

  _unindexRel(rel) {
    [rel.sourceId, rel.targetId].forEach(id => {
      const set = this._relIndex.get(id);
      if (set) {
        set.delete(rel.id);
        if (set.size === 0) this._relIndex.delete(id);
      }
    });
  }

  _emit(eventName, detail) {
    if (this._eventBus) {
      this._eventBus.emit(eventName, detail);
    }
  }

  getIndex() {
    return this._index;
  }

  setPool(pool) {
    this._pool = pool;
  }

  addCard(card) {
    const newCard = Utils.deepClone(card);
    newCard.updatedAt = Date.now();
    if (!newCard.position) {
      newCard.position = { x: 0, y: 0 };
    }
    if (this._pool && newCard.type && !this.cards.has(newCard.id)) {
      const pooled = this._pool.acquire(newCard.type);
      if (pooled) {
        pooled.id = newCard.id || Utils.generateId('card');
        pooled.type = newCard.type;
        pooled.props = { ...newCard.props };
        pooled.position = newCard.position || { x: 0, y: 0 };
        pooled.status = newCard.status || 'active';
        pooled.createdAt = Date.now();
        pooled.updatedAt = Date.now();
        this.cards.set(pooled.id, pooled);
        this._index.add(pooled);
        this._invalidateSnapshot(pooled.id);
        this.notify();
        this._emit(EVENT_TYPES.CARD_ADDED, { card: pooled });
        return pooled;
      }
    }
    this.cards.set(newCard.id, newCard);
    this._index.add(newCard);
    this._invalidateSnapshot(newCard.id);
    this.notify();
    this._emit(EVENT_TYPES.CARD_ADDED, { card: newCard });
    return newCard;
  }

  updateCard(card) {
    if (!this.cards.has(card.id)) return null;
    const updatedCard = Utils.deepClone(card);
    updatedCard.updatedAt = Date.now();
    this.cards.set(updatedCard.id, updatedCard);
    this._index.add(updatedCard);
    this._invalidateSnapshot(updatedCard.id);
    this.notify();
    this._emit(EVENT_TYPES.CARD_UPDATED, { card: updatedCard });
    return updatedCard;
  }

  updateCardProps(id, props) {
    const card = this.getCard(id);
    if (!card) return null;
    card.props = { ...card.props, ...props };
    return this.updateCard(card);
  }

  removeCard(id) {
    if (!this.cards.has(id)) return false;
    const card = this.cards.get(id);
    this.cards.delete(id);
    this._index.remove(id);
    this._invalidateSnapshot(id);
    if (this._pool && card.type) {
      this._pool.release(card);
    }
    const relIdsToDelete = this._relIndex.has(id)
      ? Array.from(this._relIndex.get(id))
      : [];
    relIdsToDelete.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel) this._unindexRel(rel);
      this.relationships.delete(relId);
    });
    this.notify();
    this._emit(EVENT_TYPES.CARD_REMOVED, { cardId: id, card });
    return true;
  }

  getCard(id) {
    const c = this.cards.get(id);
    return c ? Utils.deepClone(c) : undefined;
  }

  getAllCards() {
    return Array.from(this.cards.values()).map(c => this._snapshot(c));
  }

  getCardsByType(type) {
    const ids = this._index.queryByType(type);
    const result = [];
    ids.forEach(id => {
      const c = this.cards.get(id);
      if (c) result.push(this._snapshot(c));
    });
    return result;
  }

  getCardsByTag(tag) {
    const ids = this._index.queryByTag(tag);
    const result = [];
    ids.forEach(id => {
      const c = this.cards.get(id);
      if (c) result.push(this._snapshot(c));
    });
    return result;
  }

  getCardsByStatus(status) {
    const ids = this._index.queryByStatus(status);
    const result = [];
    ids.forEach(id => {
      const c = this.cards.get(id);
      if (c) result.push(this._snapshot(c));
    });
    return result;
  }

  queryCards(criteria) {
    const ids = this._index.query(criteria || {});
    const result = [];
    ids.forEach(id => {
      const c = this.cards.get(id);
      if (c) result.push(this._snapshot(c));
    });
    return result;
  }

  addRelationship(rel) {
    const newRel = {
      id: rel.id || Utils.generateId('rel'),
      type: rel.type || 'reference',
      ...rel,
      createdAt: Date.now()
    };
    this.relationships.set(newRel.id, newRel);
    this._indexRel(newRel);
    this.notify();
    this._emit(EVENT_TYPES.RELATIONSHIP_ADDED, { relationship: newRel });
    return newRel;
  }

  updateRelationship(rel) {
    if (!this.relationships.has(rel.id)) return null;
    const oldRel = this.relationships.get(rel.id);
    this._unindexRel(oldRel);
    const updatedRel = { ...rel, updatedAt: Date.now() };
    this.relationships.set(updatedRel.id, updatedRel);
    this._indexRel(updatedRel);
    this.notify();
    return updatedRel;
  }

  removeRelationship(id) {
    if (!this.relationships.has(id)) return false;
    const rel = this.relationships.get(id);
    this._unindexRel(rel);
    this.relationships.delete(id);
    this.notify();
    this._emit(EVENT_TYPES.RELATIONSHIP_REMOVED, { relationshipId: id, relationship: rel });
    return true;
  }

  getRelationship(id) {
    const rel = this.relationships.get(id);
    return rel ? Utils.deepClone(rel) : undefined;
  }

  getAllRelationships() {
    return Array.from(this.relationships.values()).map(r => Utils.deepClone(r));
  }

  getRelationshipsByCard(cardId) {
    const relIds = this._relIndex.get(cardId);
    if (!relIds) return [];
    const result = [];
    relIds.forEach(relId => {
      const rel = this.relationships.get(relId);
      if (rel) result.push(Utils.deepClone(rel));
    });
    return result;
  }

  getRelationshipsByType(type) {
    return this.getAllRelationships().filter(rel => rel.type === type);
  }

  subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('订阅者必须是函数');
    }
    this.listeners.add(listener);
    const unsubscribe = () => {
      return this.unsubscribe(listener);
    };
    unsubscribe.listener = listener;
    return unsubscribe;
  }

  unsubscribe(listener) {
    if (!listener) return false;
    if (typeof listener === 'function') {
      return this.listeners.delete(listener);
    }
    if (listener.listener && typeof listener.listener === 'function') {
      return this.listeners.delete(listener.listener);
    }
    return false;
  }

  getSubscriberCount() {
    return this.listeners.size;
  }

  notify() {
    this.listeners.forEach(listener => {
      try { listener(); } catch (e) {
        console.error(e);
        this._emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'store_error',
          message: `Store 订阅者通知错误: ${e.message}`,
          error: e,
          context: { phase: 'notify', subscriberCount: this.listeners.size },
          timestamp: Date.now()
        });
      }
    });
  }

  toJSON() {
    return {
      cards: this.getAllCards(),
      relationships: this.getAllRelationships()
    };
  }

  static fromJSON(data, eventBus = null) {
    const store = new Store(eventBus);
    if (data.cards) {
      data.cards.forEach(card => {
        store.cards.set(card.id, card);
        store._index.add(card);
      });
    }
    if (data.relationships) {
      data.relationships.forEach(rel => {
        store.relationships.set(rel.id, rel);
        store._indexRel(rel);
      });
    }
    return store;
  }
}
