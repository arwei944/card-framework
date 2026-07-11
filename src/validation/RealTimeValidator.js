/**
 * RealTimeValidator - monitors DOM mutations and periodically validates card integrity, DOM/store sync, relationships, and security.
 * @module validation/RealTimeValidator
 */

import { Utils } from '../utils/Utils.js';
import { Security } from '../security/Security.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { DEFAULT_CONFIG, EVENT_TYPES } from '../utils/constants.js';

export class RealTimeValidator {
  constructor(container, typeRegistry, store, autoFixer, eventBus) {
    this.container = container;
    this.typeRegistry = typeRegistry;
    this.store = store;
    this.autoFixer = autoFixer;
    this._eventBus = eventBus;
    this.observer = null;
    this.enabled = true;
    this._isSyncing = false;
    this._timer = null;
    this._checkInterval = DEFAULT_CONFIG.FULL_CHECK_INTERVAL_MS;
    this._lastCheck = 0;
    this._debouncedValidate = Utils.debounce(() => this.validateAll(), 100);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) {
      if (!this.observer) this.start();
      this._startPeriodicCheck();
    } else {
      if (this.observer) this.stop();
      this._stopPeriodicCheck();
    }
  }

  setCheckInterval(ms) {
    this._checkInterval = ms;
    if (this._timer) {
      this._stopPeriodicCheck();
      this._startPeriodicCheck();
    }
  }

  start() {
    if (this.observer || !this.container) return;

    this.observer = new MutationObserver((mutations) => {
      if (!this.enabled || this._isSyncing) return;
      this.handleMutations(mutations);
    });

    this.observer.observe(this.container, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });

    this._startPeriodicCheck();
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this._stopPeriodicCheck();
  }

  _startPeriodicCheck() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      if (!this.enabled) return;
      this.fullCheck();
    }, this._checkInterval);
  }

  _stopPeriodicCheck() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  handleMutations(mutations) {
    this._debouncedValidate();
  }

  fullCheck() {
    if (!this.enabled || this._isSyncing) return;

    this._lastCheck = Date.now();
    const results = {
      cardErrors: [],
      domStoreMismatch: [],
      relationshipErrors: [],
      securityIssues: [],
      timestamp: Date.now()
    };

    const cards = this.store.getAllCards();
    cards.forEach(card => {
      const validation = this.typeRegistry.validate(card);
      if (!validation.valid) {
        results.cardErrors.push({ cardId: card.id, errors: validation.errors });
      }
      if (validation.warnings && validation.warnings.length > 0) {
        results.securityIssues.push({ cardId: card.id, warnings: validation.warnings });
      }
    });

    const domSyncResult = this._checkDomStoreSync();
    results.domStoreMismatch = domSyncResult.mismatches;

    const relResult = this._checkRelationshipIntegrity();
    results.relationshipErrors = relResult.errors;

    const securityResult = this._checkSecurityIssues();
    results.securityIssues = [...results.securityIssues, ...securityResult.issues];

    const hasIssues = results.cardErrors.length > 0 ||
                      results.domStoreMismatch.length > 0 ||
                      results.relationshipErrors.length > 0 ||
                      results.securityIssues.length > 0;

    if (hasIssues) {
      this._eventBus.emit('fullCheckFailed', results);
      FeedbackSystem.warn(
        '全量检查发现问题',
        `卡片错误: ${results.cardErrors.length}，DOM/Store 不一致: ${results.domStoreMismatch.length}，关系错误: ${results.relationshipErrors.length}，安全问题: ${results.securityIssues.length}`
      );
    }

    return results;
  }

  _checkSecurityIssues() {
    const issues = [];

    if (!this.container) return { issues };

    const allElements = this.container.querySelectorAll('*');
    allElements.forEach(el => {
      for (const attr of el.attributes) {
        const attrName = attr.name.toLowerCase();
        if (attrName.startsWith('on')) {
          issues.push({
            type: 'inline-event-handler',
            severity: 'high',
            element: el.tagName,
            attribute: attrName,
            message: `检测到内联事件处理器 "${attrName}"，存在 XSS 风险`
          });
        }
      }

      if (el.hasAttribute('style')) {
        const styleValue = el.getAttribute('style');
        const safeStyle = Security.sanitizeStyle(styleValue);
        if (safeStyle !== styleValue) {
          issues.push({
            type: 'dangerous-style',
            severity: 'high',
            element: el.tagName,
            cardId: el.closest('[data-card-id]')?.dataset?.cardId,
            message: '检测到危险的 style 属性内容'
          });
        }
      }

      if (el.tagName === 'A' || el.tagName === 'AREA') {
        const href = el.getAttribute('href');
        if (href && !Security.isSafeUrl(href)) {
          issues.push({
            type: 'dangerous-url',
            severity: 'high',
            element: el.tagName,
            cardId: el.closest('[data-card-id]')?.dataset?.cardId,
            attribute: 'href',
            value: href,
            message: '检测到危险的 URL 协议'
          });
        }
      }

      if (el.tagName === 'IFRAME' || el.tagName === 'SCRIPT') {
        issues.push({
          type: 'dangerous-element',
          severity: 'high',
          element: el.tagName,
          cardId: el.closest('[data-card-id]')?.dataset?.cardId,
          message: `检测到危险元素 <${el.tagName.toLowerCase()}>`
        });
      }
    });

    return { issues };
  }

  _checkDomStoreSync() {
    const mismatches = [];
    const cardEls = this.container.querySelectorAll('[data-card-id]');
    const domCardIds = new Set();
    const domCards = new Map();

    cardEls.forEach(el => {
      const cardId = el.dataset.cardId;
      domCardIds.add(cardId);
      domCards.set(cardId, {
        type: el.dataset.cardType,
        title: el.querySelector('.card-title')?.textContent || ''
      });
    });

    const storeCards = this.store.getAllCards();
    storeCards.forEach(card => {
      if (!domCardIds.has(card.id)) {
        mismatches.push({
          type: 'store_only',
          cardId: card.id,
          card: card
        });
      } else {
        const domCard = domCards.get(card.id);
        if (domCard && domCard.type !== card.type) {
          mismatches.push({
            type: 'type_mismatch',
            cardId: card.id,
            storeType: card.type,
            domType: domCard.type
          });
        }
      }
    });

    domCardIds.forEach(cardId => {
      if (!this.store.getCard(cardId)) {
        mismatches.push({
          type: 'dom_only',
          cardId: cardId,
          domCard: domCards.get(cardId)
        });
      }
    });

    return { mismatches };
  }

  _checkRelationshipIntegrity() {
    const errors = [];
    const relationships = this.store.getAllRelationships();
    const cardIds = new Set(this.store.getAllCards().map(c => c.id));

    relationships.forEach(rel => {
      if (!cardIds.has(rel.sourceId)) {
        errors.push({
          type: 'missing_source',
          relId: rel.id,
          sourceId: rel.sourceId,
          targetId: rel.targetId
        });
      }
      if (!cardIds.has(rel.targetId)) {
        errors.push({
          type: 'missing_target',
          relId: rel.id,
          sourceId: rel.sourceId,
          targetId: rel.targetId
        });
      }
    });

    return { errors };
  }

  validateAll() {
    if (!this.enabled || this._isSyncing) return;

    const errors = [];
    const cards = this.store.getAllCards();

    cards.forEach(card => {
      const validation = this.typeRegistry.validate(card);
      if (!validation.valid) {
        errors.push({ cardId: card.id, errors: validation.errors });
      }
    });

    if (errors.length > 0) {
      errors.forEach(({ cardId, errors: cardErrors }) => {
        this._eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, { cardId, errors: cardErrors });
      });
    }
  }

  syncFromDOM() {
    if (this._isSyncing) return;
    this._isSyncing = true;

    const cardEls = this.container.querySelectorAll('[data-card-id]');
    const domCardIds = new Set();

    cardEls.forEach(el => {
      const cardId = el.dataset.cardId;
      domCardIds.add(cardId);

      const storeCard = this.store.getCard(cardId);
      if (!storeCard) {
        const type = el.dataset.cardType || 'text';
        const newCard = {
          id: cardId,
          type,
          props: {
            title: el.querySelector('.card-title')?.textContent || ''
          },
          position: { x: 0, y: 0 },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        this.store.addCard(newCard);
        FeedbackSystem.fix('从 DOM 中恢复卡片', `cardId: ${cardId}`);
      }
    });

    const storeCards = this.store.getAllCards();
    storeCards.forEach(card => {
      if (!domCardIds.has(card.id)) {
        FeedbackSystem.warn(
          `Store 中的卡片 ${card.id} 在 DOM 中不存在，已重新渲染`,
          '检查是否有外部代码移除了卡片元素'
        );
      }
    });

    this._isSyncing = false;
    this._eventBus.emit(EVENT_TYPES.DOM_SYNCHRONIZED, { cardCount: domCardIds.size });
  }

  pause() {
    this._isSyncing = true;
  }

  resume() {
    this._isSyncing = false;
  }

  getLastCheckTime() {
    return this._lastCheck;
  }
}
