/**
 * Renderer — renders cards into DOM elements and manages the render lifecycle.
 * @module render/Renderer
 */

import { Utils } from '../utils/Utils.js';
import { Security } from '../security/Security.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { Perf } from '../perf/Perf.js';
import { EVENT_TYPES } from '../utils/constants.js';

export class Renderer {
  constructor(container, typeRegistry, store, eventBus) {
    this.container = container;
    this.typeRegistry = typeRegistry;
    this.store = store;
    this._eventBus = eventBus;
    this._lastCardIds = [];
    this._eventListeners = new Map();
    this._rafId = null;
    this._pendingCards = null;
    this._batchRendering = false;
  }

  renderTemplate(template, props) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = props[key];
      if (value === undefined || value === null) return '';
      return Utils.escapeHtml(String(value));
    });
  }

  _trackEventListener(cardId, element, event, handler) {
    if (!this._eventListeners.has(cardId)) {
      this._eventListeners.set(cardId, []);
    }
    this._eventListeners.get(cardId).push({ element, event, handler });
    element.addEventListener(event, handler);
  }

  cleanupCardElement(cardId) {
    const listeners = this._eventListeners.get(cardId);
    if (listeners) {
      listeners.forEach(({ element, event, handler }) => {
        try {
          element.removeEventListener(event, handler);
        } catch (e) {}
      });
      this._eventListeners.delete(cardId);
    }
  }

  renderCard(card) {
    try {
      const typeDef = this.typeRegistry.get(card.type);
      if (!typeDef) {
        return this.renderError(card, new Error(`未知类型: ${card.type}`));
      }

      const template = typeDef.renderTemplate;
      const props = { ...card.props, id: card.id, status: card.status, icon: typeDef.icon };
      const html = this.renderTemplate(template, props);

      const el = document.createElement('div');
      el.innerHTML = html;
      const cardEl = el.firstElementChild;

      cardEl.dataset.cardId = card.id;
      cardEl.dataset.cardType = card.type;
      cardEl.classList.add('card');

      if (card.status === 'completed') {
        cardEl.classList.add('card-completed');
      }

      if (typeDef.defaultStyle) {
        Object.assign(cardEl.style, typeDef.defaultStyle);
      }

      if (card.style) {
        const styleResult = Security.sanitizeStyleObject(card.style);
        if (styleResult.changed) {
          FeedbackSystem.info(
            `卡片 ${card.id} 的 style 属性已安全过滤`,
            styleResult.removedProps.length > 0 ? `已移除危险属性: ${styleResult.removedProps.join(', ')}` : ''
          );
        }
        Object.assign(cardEl.style, styleResult.sanitized);
      }

      if (card.position) {
        cardEl.style.position = 'absolute';
        cardEl.style.left = card.position.x + 'px';
        cardEl.style.top = card.position.y + 'px';
      }

      if (typeDef.actions) {
        typeDef.actions.forEach(action => {
          const btn = cardEl.querySelector(`[data-action="${action.name}"]`);
          if (btn) {
            const handler = (e) => {
              e.stopPropagation();
              action.handler(card, this.store, e);
            };
            this._trackEventListener(card.id, btn, 'click', handler);
          }
        });
      }

      const imgEl = cardEl.querySelector('.card-image-img');
      if (imgEl) {
        const imgErrorHandler = () => {
          const container = imgEl.parentElement;
          if (container) {
            const placeholder = document.createElement('div');
            placeholder.className = 'card-image-placeholder';
            placeholder.textContent = '🖼️ 图片加载失败';
            container.innerHTML = '';
            container.appendChild(placeholder);
          }
        };
        if (imgEl.complete && imgEl.naturalWidth === 0) {
          imgErrorHandler();
        } else {
          this._trackEventListener(card.id, imgEl, 'error', imgErrorHandler);
        }
      }

      const dblClickHandler = (e) => {
        if (e.target.closest('button, input, textarea')) return;
        this._eventBus.emit('cardDoubleClick', { card, event: e });
      };
      this._trackEventListener(card.id, cardEl, 'dblclick', dblClickHandler);

      return cardEl;
    } catch (error) {
      return this.renderError(card, error);
    }
  }

  updateCardElement(cardEl, card) {
    const typeDef = this.typeRegistry.get(card.type);
    if (!typeDef) return;

    const oldType = cardEl.dataset.cardType;
    if (oldType !== card.type) {
      this.cleanupCardElement(card.id);
      const newEl = this.renderCard(card);
      cardEl.replaceWith(newEl);
      return newEl;
    }

    cardEl.dataset.cardId = card.id;
    cardEl.dataset.cardType = card.type;

    if (card.status === 'completed') {
      cardEl.classList.add('card-completed');
    } else {
      cardEl.classList.remove('card-completed');
    }

    const template = typeDef.renderTemplate;
    const props = { ...card.props, id: card.id, status: card.status, icon: typeDef.icon };
    const newHtml = this.renderTemplate(template, props);
    const tempEl = document.createElement('div');
    tempEl.innerHTML = newHtml;
    const newCardEl = tempEl.firstElementChild;

    this._updateElementContent(cardEl, newCardEl);

    const imgEl = cardEl.querySelector('.card-image-img');
    if (imgEl) {
      const imgErrorHandler = () => {
        const container = imgEl.parentElement;
        if (container) {
          const placeholder = document.createElement('div');
          placeholder.className = 'card-image-placeholder';
          placeholder.textContent = '🖼️ 图片加载失败';
          container.innerHTML = '';
          container.appendChild(placeholder);
        }
      };
      if (imgEl.complete && imgEl.naturalWidth === 0) {
        imgErrorHandler();
      } else {
        this._trackEventListener(card.id, imgEl, 'error', imgErrorHandler);
      }
    }

    if (typeDef.defaultStyle) {
      Object.assign(cardEl.style, typeDef.defaultStyle);
    }

    if (card.style) {
      const styleResult = Security.sanitizeStyleObject(card.style);
      if (styleResult.changed) {
        FeedbackSystem.info(
          `卡片 ${card.id} 的 style 属性已安全过滤`,
          styleResult.removedProps.length > 0 ? `已移除危险属性: ${styleResult.removedProps.join(', ')}` : ''
        );
      }
      Object.assign(cardEl.style, styleResult.sanitized);
    }

    if (card.position) {
      cardEl.style.position = 'absolute';
      cardEl.style.left = card.position.x + 'px';
      cardEl.style.top = card.position.y + 'px';
    }

    return cardEl;
  }

  _updateElementContent(oldEl, newEl) {
    if (oldEl.innerHTML !== newEl.innerHTML) {
      oldEl.innerHTML = newEl.innerHTML;
    }
    if (oldEl.className !== newEl.className) {
      oldEl.className = newEl.className;
    }
  }

  renderCards(cards) {
    if (this._batchRendering) {
      this._pendingCards = cards;
      return;
    }

    this._batchRendering = true;
    this._pendingCards = cards;

    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      const currentCards = this._pendingCards || cards;
      this._pendingCards = null;
      this._doRenderCards(currentCards);
      this._batchRendering = false;
    });
  }

  _doRenderCards(cards) {
    Perf.mark('render_start');

    const currentIds = cards.map(c => c.id);
    const lastIds = this._lastCardIds;
    const lastIdSet = new Set(lastIds);
    const currentIdSet = new Set(currentIds);

    const addedIds = currentIds.filter(id => !lastIdSet.has(id));
    const removedIds = lastIds.filter(id => !currentIdSet.has(id));
    const updatedIds = currentIds.filter(id => lastIdSet.has(id));

    removedIds.forEach(id => {
      const el = this.container.querySelector(`[data-card-id="${id}"]`);
      if (el) {
        this.cleanupCardElement(id);
        el.remove();
      }
    });

    const cardMap = new Map(cards.map(c => [c.id, c]));

    updatedIds.forEach(id => {
      const el = this.container.querySelector(`[data-card-id="${id}"]`);
      const card = cardMap.get(id);
      if (el && card) {
        this.updateCardElement(el, card);
      }
    });

    const idOrderMap = new Map(currentIds.map((id, index) => [id, index]));
    const existingChildren = Array.from(this.container.children).filter(
      child => child.dataset && child.dataset.cardId && currentIdSet.has(child.dataset.cardId)
    );

    existingChildren.sort((a, b) => {
      const orderA = idOrderMap.get(a.dataset.cardId);
      const orderB = idOrderMap.get(b.dataset.cardId);
      return orderA - orderB;
    });

    existingChildren.forEach(child => this.container.appendChild(child));

    addedIds.forEach(id => {
      const card = cardMap.get(id);
      if (card) {
        const el = this.renderCard(card);
        const index = idOrderMap.get(id);
        const referenceNode = this.container.children[index] || null;
        this.container.insertBefore(el, referenceNode);
      }
    });

    this._lastCardIds = currentIds;

    Perf.mark('render_end');
    const duration = Perf.measure('render', 'render_start', 'render_end');
    if (duration !== null) {
      Perf.recordRender(duration, cards.length);
    }
  }

  renderError(card, error) {
    console.error('[CardFrame] 卡片渲染错误:', card.id, error);
    this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
      type: 'render_error',
      message: error.message,
      error: error,
      context: { cardId: card.id, cardType: card.type, phase: 'renderError' },
      timestamp: Date.now()
    });

    const el = document.createElement('div');
    el.className = 'card card-error';
    el.dataset.cardId = card.id;
    el.innerHTML = `
      <div class="card-header">
        <span class="card-icon">⚠️</span>
        <h3 class="card-title">卡片渲染错误</h3>
      </div>
      <div class="card-body">
        <p>类型: ${Utils.escapeHtml(card.type)}</p>
        <p>ID: ${Utils.escapeHtml(card.id)}</p>
        <p class="error-message">${Utils.escapeHtml(error.message)}</p>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" data-action="retry">重试</button>
        <button class="btn btn-danger" data-action="delete">删除</button>
      </div>
    `;

    const retryHandler = () => {
      this._eventBus.emit(EVENT_TYPES.CARD_UPDATED, { card });
    };
    this._trackEventListener(card.id, el.querySelector('[data-action="retry"]'), 'click', retryHandler);

    const deleteHandler = () => {
      if (confirm('确定删除这张卡片吗？')) {
        this.store && this.store.removeCard(card.id);
      }
    };
    this._trackEventListener(card.id, el.querySelector('[data-action="delete"]'), 'click', deleteHandler);

    return el;
  }

  forceFullRender(cards) {
    this._lastCardIds = [];
    // T7.06 — detach every tracked listener before dropping the nodes so the
    // handlers (and their closures) are not leaked when the map is cleared.
    Array.from(this._eventListeners.keys()).forEach(cardId => {
      this.cleanupCardElement(cardId);
    });
    this.container.innerHTML = '';
    this._eventListeners.clear();
    this.renderCards(cards);
  }
}
