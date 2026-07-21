/**
 * Relationship + action-history methods mixed into CardFrame.prototype.
 * @module core/cardframe/relationshipMethods
 */

export const relationshipMethods = {
  undo() {
    return this.actionLogger.undo(this.store);
  },

  redo() {
    return this.actionLogger.redo(this.store);
  },

  rollback(timestamp) {
    return this.actionLogger.rollback(timestamp, this.store);
  },

  getActionHistory() {
    return this.actionLogger.getHistory();
  },

  clearActionHistory() {
    this.actionLogger.clear();
  },

  createRelationship(sourceId, targetId, type = 'reference', data = {}) {
    const rel = this.store.addRelationship({
      sourceId,
      targetId,
      type,
      data
    });
    if (rel) {
      this.actionLogger.record('addRelationship', { relationship: { ...rel } });
    }
    return rel;
  },

  removeRelationship(id) {
    const rel = this.store.getRelationship(id);
    const result = this.store.removeRelationship(id);
    if (rel && result) {
      this.actionLogger.record('removeRelationship', { relationship: { ...rel } });
    }
    return result;
  },

  getRelationship(id) {
    return this.store.getRelationship(id);
  },

  getAllRelationships() {
    return this.store.getAllRelationships();
  },

  getRelationshipsByCard(cardId) {
    return this.store.getRelationshipsByCard(cardId);
  },

  getRelationshipsByType(type) {
    return this.store.getRelationshipsByType(type);
  }
};
