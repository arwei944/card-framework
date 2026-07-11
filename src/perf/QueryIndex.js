/**
 * QueryIndex — indexed lookup for cards by type, tag, and status.
 * @module perf/QueryIndex
 */

export class QueryIndex {
  constructor() {
    this._byType = new Map();
    this._byTag = new Map();
    this._byStatus = new Map();
    this._byId = new Map();
  }

  add(card) {
    if (!card || !card.id) return;
    this._removeFromSets(card.id, this._byId.get(card.id));
    const meta = {
      type: card.type,
      tags: new Set(Array.isArray(card.props?.tags) ? card.props.tags : []),
      status: card.status || 'active'
    };
    this._byId.set(card.id, meta);

    this._addToSet(this._byType, meta.type, card.id);
    meta.tags.forEach(tag => this._addToSet(this._byTag, tag, card.id));
    this._addToSet(this._byStatus, meta.status, card.id);
  }

  _addToSet(map, key, id) {
    if (!key) return;
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(id);
  }

  _removeFromSets(id, meta) {
    if (!meta) return;
    this._removeFromSet(this._byType, meta.type, id);
    if (meta.tags) {
      meta.tags.forEach(tag => this._removeFromSet(this._byTag, tag, id));
    }
    this._removeFromSet(this._byStatus, meta.status, id);
  }

  _removeFromSet(map, key, id) {
    if (!key) return;
    const set = map.get(key);
    if (!set) return;
    set.delete(id);
    if (set.size === 0) map.delete(key);
  }

  remove(cardId) {
    if (!cardId) return;
    const meta = this._byId.get(cardId);
    if (!meta) return;
    this._removeFromSets(cardId, meta);
    this._byId.delete(cardId);
  }

  update(card) {
    this.add(card);
  }

  queryByType(type) {
    const set = this._byType.get(type);
    return set ? Array.from(set) : [];
  }

  queryByTag(tag) {
    const set = this._byTag.get(tag);
    return set ? Array.from(set) : [];
  }

  queryByStatus(status) {
    const set = this._byStatus.get(status);
    return set ? Array.from(set) : [];
  }

  query(criteria = {}) {
    let result = null;
    if (criteria.type) {
      result = new Set(this.queryByType(criteria.type));
    }
    if (criteria.tag) {
      const tagSet = new Set(this.queryByTag(criteria.tag));
      result = result ? this._intersect(result, tagSet) : tagSet;
    }
    if (criteria.status) {
      const statusSet = new Set(this.queryByStatus(criteria.status));
      result = result ? this._intersect(result, statusSet) : statusSet;
    }
    return result ? Array.from(result) : [];
  }

  _intersect(setA, setB) {
    const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
    const result = new Set();
    small.forEach(id => {
      if (large.has(id)) result.add(id);
    });
    return result;
  }

  clear() {
    this._byType.clear();
    this._byTag.clear();
    this._byStatus.clear();
    this._byId.clear();
  }

  getStats() {
    return {
      total: this._byId.size,
      byType: this._byType.size,
      byTag: this._byTag.size,
      byStatus: this._byStatus.size
    };
  }
}
