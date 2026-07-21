/**
 * Batch CRUD methods mixed into CardFrame.prototype.
 * @module core/cardframe/batchMethods
 */

import { EVENT_TYPES } from '../../utils/constants.js';

export const batchMethods = {
  /**
   * 批量创建卡片
   * @param {Array<Object>} cards
   * @returns {{ success: Array, errors: Array }}
   */
  batchCreateCards(cards) {
    const results = [];
    const errors = [];

    cards.forEach((cardData, index) => {
      try {
        const card = this.createCard(cardData.type, cardData.props || {});
        let changed = false;
        if (cardData.position) { card.position = cardData.position; changed = true; }
        if (cardData.status) { card.status = cardData.status; changed = true; }
        if (cardData.style) { card.style = cardData.style; changed = true; }

        if (cardData.id && cardData.id !== card.id) {
          const oldId = card.id;
          card.id = cardData.id;
          this.store.rekeyCard(oldId, card);
        } else if (changed) {
          this.store.updateCard(card);
        }
        results.push(card);
      } catch (e) {
        errors.push({ index, error: e.message, cardData });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量创建卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchCreateCards', index, cardData },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  },

  /**
   * 批量更新卡片
   * @param {Array<Object>} updates
   * @returns {{ success: Array, errors: Array }}
   */
  batchUpdateCards(updates) {
    const results = [];
    const errors = [];

    updates.forEach((update, index) => {
      try {
        const card = this.getCard(update.id);
        if (!card) {
          errors.push({ index, error: `卡片 ${update.id} 不存在`, update });
          return;
        }
        const updated = { ...card, ...update, id: update.id };
        const result = this.updateCard(updated);
        results.push(result);
      } catch (e) {
        errors.push({ index, error: e.message, update });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量更新卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchUpdateCards', index, update },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  },

  /**
   * 批量删除卡片
   * @param {Array<string>} ids
   * @returns {{ success: Array, errors: Array }}
   */
  batchRemoveCards(ids) {
    const results = [];
    const errors = [];

    ids.forEach((id, index) => {
      try {
        const success = this.removeCard(id);
        if (success) {
          results.push(id);
        } else {
          errors.push({ index, error: `卡片 ${id} 删除失败`, id });
        }
      } catch (e) {
        errors.push({ index, error: e.message, id });
        this.eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'batch_error',
          message: `批量删除卡片失败 (索引 ${index}): ${e.message}`,
          error: e,
          context: { operation: 'batchRemoveCards', index, id },
          timestamp: Date.now()
        });
      }
    });

    return { success: results, errors };
  }
};
