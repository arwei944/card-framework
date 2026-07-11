/**
 * AutoFixer - automatically fixes card validation errors, DOM/store sync mismatches, and relationship integrity issues.
 * @module validation/AutoFixer
 */

import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { EVENT_TYPES } from '../utils/constants.js';

export class AutoFixer {
  constructor(typeRegistry, store, container = null, eventBus) {
    this.typeRegistry = typeRegistry;
    this.store = store;
    this.container = container;
    this._eventBus = eventBus;
    this.enabled = true;
    this._fixStats = {
      totalFixes: 0,
      cardFixes: 0,
      domSyncFixes: 0,
      relationshipFixes: 0
    };
  }

  setContainer(container) {
    this.container = container;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  fixCard(card, validationResult) {
    if (!this.enabled) return { fixed: false, changes: [] };

    const changes = [];
    const typeDef = this.typeRegistry.get(card.type);
    if (!typeDef) return { fixed: false, changes: [] };

    validationResult.errors.forEach(error => {
      if (error.type === 'required') {
        const defaultValue = this.typeRegistry.getDefaultValue(card.type, error.prop);
        if (defaultValue !== undefined) {
          card.props[error.prop] = defaultValue;
          changes.push({ prop: error.prop, fix: 'defaultValue', value: defaultValue });
          FeedbackSystem.fix(`属性 "${error.prop}" 缺失，已填充默认值：${defaultValue}`);
        }
      } else if (error.type === 'type') {
        const propSchema = this.typeRegistry.getPropSchema(card.type, error.prop);
        if (propSchema && propSchema.defaultValue !== undefined) {
          card.props[error.prop] = propSchema.defaultValue;
          changes.push({ prop: error.prop, fix: 'rollback', value: propSchema.defaultValue });
          FeedbackSystem.fix(`属性 "${error.prop}" 类型错误，已回滚到默认值`);
        }
      } else if (error.type === 'allowedValues') {
        const propSchema = this.typeRegistry.getPropSchema(card.type, error.prop);
        if (propSchema && propSchema.defaultValue !== undefined) {
          card.props[error.prop] = propSchema.defaultValue;
          changes.push({ prop: error.prop, fix: 'allowedValuesFallback', value: propSchema.defaultValue });
          FeedbackSystem.fix(
            `属性 "${error.prop}" 值不在允许列表中`,
            `允许值：${propSchema.allowedValues.join(', ')}，已自动设置为默认值：${propSchema.defaultValue}`
          );
        }
      }
    });

    if (changes.length > 0) {
      this._fixStats.totalFixes++;
      this._fixStats.cardFixes++;
      this._eventBus.emit(EVENT_TYPES.CARD_AUTO_FIXED, { cardId: card.id, changes });
    }

    return { fixed: changes.length > 0, changes };
  }

  fixStructure(element, expectedParent) {
    if (!this.enabled) return false;

    if (element.parentElement !== expectedParent) {
      FeedbackSystem.fix('卡片位置不正确，已自动归位到正确容器');
      expectedParent.appendChild(element);
      this._fixStats.totalFixes++;
      this._fixStats.domSyncFixes++;
      return true;
    }
    return false;
  }

  fixDomStoreSync(mismatches) {
    if (!this.enabled || !this.container) return { fixed: 0, details: [] };

    const details = [];
    let fixedCount = 0;

    mismatches.forEach(mismatch => {
      if (mismatch.type === 'store_only') {
        const card = mismatch.card;
        const cardEl = this.container.querySelector(`[data-card-id="${card.id}"]`);
        if (!cardEl) {
          FeedbackSystem.fix(`DOM 中缺失卡片 ${card.id}，已重新渲染`);
          details.push({ type: 'store_only', cardId: card.id, action: 're-rendered' });
          fixedCount++;
        }
      } else if (mismatch.type === 'dom_only') {
        const cardId = mismatch.cardId;
        const domCard = mismatch.domCard;
        const newCard = {
          id: cardId,
          type: domCard.type || 'text',
          props: { title: domCard.title || '未命名卡片' },
          position: { x: 0, y: 0 },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.store.addCard(newCard);
        FeedbackSystem.fix(`Store 中缺失卡片 ${cardId}，已从 DOM 恢复`);
        details.push({ type: 'dom_only', cardId, action: 'restored' });
        fixedCount++;
      } else if (mismatch.type === 'type_mismatch') {
        const card = this.store.getCard(mismatch.cardId);
        if (card) {
          card.type = mismatch.storeType;
          this.store.updateCard(card);
          FeedbackSystem.fix(`卡片 ${mismatch.cardId} 类型不一致，已以 Store 为准同步`);
          details.push({ type: 'type_mismatch', cardId: mismatch.cardId, action: 'synced' });
          fixedCount++;
        }
      }
    });

    if (fixedCount > 0) {
      this._fixStats.totalFixes += fixedCount;
      this._fixStats.domSyncFixes += fixedCount;
    }

    return { fixed: fixedCount, details };
  }

  fixRelationships(errors) {
    if (!this.enabled) return { fixed: 0, details: [] };

    const details = [];
    let fixedCount = 0;

    errors.forEach(error => {
      if (error.type === 'missing_source' || error.type === 'missing_target') {
        const rel = this.store.getRelationship(error.relId);
        if (rel) {
          this.store.removeRelationship(error.relId);
          FeedbackSystem.fix(`关系 ${error.relId} 引用了不存在的卡片，已删除`);
          details.push({
            type: error.type,
            relId: error.relId,
            action: 'removed',
            sourceId: error.sourceId,
            targetId: error.targetId
          });
          fixedCount++;
        }
      }
    });

    if (fixedCount > 0) {
      this._fixStats.totalFixes += fixedCount;
      this._fixStats.relationshipFixes += fixedCount;
    }

    return { fixed: fixedCount, details };
  }

  fixAll() {
    if (!this.enabled) return { cardFixed: 0, domSyncFixed: 0, relationshipFixed: 0 };

    const results = {
      cardFixed: 0,
      domSyncFixed: 0,
      relationshipFixed: 0
    };

    const cards = this.store.getAllCards();
    cards.forEach(card => {
      const validation = this.typeRegistry.validate(card);
      if (!validation.valid) {
        const fixResult = this.fixCard(card, validation);
        if (fixResult.fixed) {
          this.store.updateCard(card);
          results.cardFixed++;
        }
      }
    });

    const validator = this._getValidator();
    if (validator && validator._checkDomStoreSync) {
      const syncResult = validator._checkDomStoreSync();
      if (syncResult.mismatches.length > 0) {
        const fixResult = this.fixDomStoreSync(syncResult.mismatches);
        results.domSyncFixed = fixResult.fixed;
      }
    }

    if (validator && validator._checkRelationshipIntegrity) {
      const relResult = validator._checkRelationshipIntegrity();
      if (relResult.errors.length > 0) {
        const fixResult = this.fixRelationships(relResult.errors);
        results.relationshipFixed = fixResult.fixed;
      }
    }

    return results;
  }

  getStats() {
    return { ...this._fixStats };
  }

  resetStats() {
    this._fixStats = {
      totalFixes: 0,
      cardFixes: 0,
      domSyncFixes: 0,
      relationshipFixes: 0
    };
  }

  _getValidator() {
    return null;
  }
}
