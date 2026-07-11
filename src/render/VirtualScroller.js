/**
 * Virtual scrolling engine for efficient rendering of large card lists.
 * @module render/VirtualScroller
 */

import { Utils } from '../utils/Utils.js';
import { DEFAULT_CONFIG } from '../utils/constants.js';

export class VirtualScroller {
  constructor(container, store, renderer, options = {}) {
    this.container = container;
    this.store = store;
    this.renderer = renderer;
    this.enabled = false;
    this.overscan = options.overscan || DEFAULT_CONFIG.VIRTUAL_SCROLL_OVERSCAN;
    this._scrollContainer = null;
    this._cardHeight = DEFAULT_CONFIG.DEFAULT_CARD_HEIGHT;
    this._cardWidth = DEFAULT_CONFIG.DEFAULT_CARD_WIDTH;
    this._visibleRange = { start: 0, end: 0 };
    this._scrollHandler = null;
    this._resizeHandler = null;
    this._rafId = null;
    this._domPool = new Map();      // cardId -> DOM 元素（移出视口的缓存）
    this._visibleCardIds = new Set(); // 当前可见卡片 ID 集合
  }

  enable(options = {}) {
    if (this.enabled) return;
    if (options.overscan !== undefined) {
      this.overscan = options.overscan;
    }
    this.enabled = true;
    this._scrollContainer = this._findScrollContainer();
    if (this._scrollContainer) {
      this._setupListeners();
      this._updateVisibleRange();
    }
  }

  disable() {
    if (!this.enabled) return;
    this.enabled = false;
    this._cleanupListeners();
    this._scrollContainer = null;
  }

  isEnabled() {
    return this.enabled;
  }

  _findScrollContainer() {
    let el = this.container.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') {
        return el;
      }
      el = el.parentElement;
    }
    return window;
  }

  _setupListeners() {
    this._scrollHandler = Utils.throttle(() => {
      this._onScroll();
    }, 16);
    this._resizeHandler = Utils.debounce(() => {
      this._updateVisibleRange();
    }, 100);

    if (this._scrollContainer === window) {
      window.addEventListener('scroll', this._scrollHandler, { passive: true });
      window.addEventListener('resize', this._resizeHandler);
    } else {
      this._scrollContainer.addEventListener('scroll', this._scrollHandler, { passive: true });
      this._scrollContainer.addEventListener('resize', this._resizeHandler);
      window.addEventListener('resize', this._resizeHandler);
    }
  }

  _cleanupListeners() {
    if (this._scrollHandler) {
      if (this._scrollContainer === window) {
        window.removeEventListener('scroll', this._scrollHandler);
        window.removeEventListener('resize', this._resizeHandler);
      } else {
        if (this._scrollContainer) {
          this._scrollContainer.removeEventListener('scroll', this._scrollHandler);
          this._scrollContainer.removeEventListener('resize', this._resizeHandler);
        }
        window.removeEventListener('resize', this._resizeHandler);
      }
      this._scrollHandler = null;
      this._resizeHandler = null;
    }
  }

  _onScroll() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._updateVisibleRange();
    });
  }

  _getContainerRect() {
    if (this._scrollContainer === window) {
      return {
        top: 0,
        bottom: window.innerHeight,
        height: window.innerHeight
      };
    }
    const rect = this._scrollContainer.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height
    };
  }

  _estimateCardDimensions() {
    const firstCard = this.container.querySelector('.card');
    if (firstCard) {
      const rect = firstCard.getBoundingClientRect();
      this._cardHeight = rect.height || 200;
      this._cardWidth = rect.width || 280;
    }
  }

  _updateVisibleRange() {
    if (!this.enabled) return;

    this._estimateCardDimensions();

    const cards = this.store.getAllCards();
    const containerRect = this._getContainerRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    const containerElRect = this.container.getBoundingClientRect();
    const containerOffsetTop = containerElRect.top;

    const cardsPerRow = Math.max(1, Math.floor(containerElRect.width / this._cardWidth));
    const rowHeight = this._cardHeight + 20;

    const visibleTop = containerTop - containerOffsetTop - this.overscan * rowHeight;
    const visibleBottom = containerBottom - containerOffsetTop + this.overscan * rowHeight;

    const startRow = Math.max(0, Math.floor(visibleTop / rowHeight));
    const endRow = Math.ceil(visibleBottom / rowHeight);

    const startIndex = Math.max(0, startRow * cardsPerRow);
    const endIndex = Math.min(cards.length, endRow * cardsPerRow + cardsPerRow);

    if (startIndex !== this._visibleRange.start || endIndex !== this._visibleRange.end) {
      this._visibleRange = { start: startIndex, end: endIndex };
      this._renderVisibleCards(cards, startIndex, endIndex);
    }
  }

  _renderVisibleCards(cards, start, end) {
    const newVisibleCards = cards.slice(start, end);
    const newVisibleIds = new Set(newVisibleCards.map(c => c.id));
    const prevVisibleIds = this._visibleCardIds;

    // 计算需要隐藏和显示的卡片
    const toHide = new Set();
    prevVisibleIds.forEach(id => {
      if (!newVisibleIds.has(id)) {
        toHide.add(id);
      }
    });

    const toShow = newVisibleCards.filter(c => !prevVisibleIds.has(c.id));

    // 隐藏移出视口的卡片：将 DOM 移到池中并隐藏
    toHide.forEach(id => {
      const existing = this.container.querySelector(`[data-card-id="${id}"]`);
      if (existing) {
        existing.style.display = 'none';
        this._domPool.set(id, existing);
      }
    });

    // 显示新进入视口的卡片：从池复用或重新渲染
    toShow.forEach(card => {
      const pooled = this._domPool.get(card.id);
      if (pooled) {
        // 复用池中 DOM：恢复显示并更新内容
        pooled.style.display = '';
        this.renderer.updateCardElement(pooled, card);
        this._domPool.delete(card.id);
      } else {
        // 渲染新卡片
        const newEl = this.renderer.renderCard(card);
        if (newEl) {
          this.container.appendChild(newEl);
        }
      }
    });

    this._visibleCardIds = newVisibleIds;
  }

  getPoolSize() {
    return this._domPool.size;
  }

  getVisibleCardCount() {
    return this._visibleCardIds.size;
  }

  getVisibleRange() {
    return { ...this._visibleRange };
  }

  setOverscan(overscan) {
    this.overscan = overscan;
    if (this.enabled) {
      this._updateVisibleRange();
    }
  }

  refresh() {
    if (this.enabled) {
      this._updateVisibleRange();
    }
  }

  destroy() {
    this.disable();
    // 清理 DOM 池中的隐藏元素
    this._domPool.forEach(el => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    this._domPool.clear();
    this._visibleCardIds.clear();
  }
}
