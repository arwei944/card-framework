/**
 * Layout engine for card-framework, supporting stream and canvas layout modes.
 * @module render/LayoutEngine
 */

import { LayoutCache } from '../perf/LayoutCache.js';
import { DEFAULT_CONFIG, EVENT_TYPES } from '../utils/constants.js';

export class LayoutEngine {
  constructor(container, store, renderer, eventBus) {
    this.container = container;
    this.store = store;
    this.renderer = renderer;
    this._eventBus = eventBus;
    this.mode = 'stream';
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this._isDragging = false;
    this._dragCard = null;
    this._dragOffset = { x: 0, y: 0 };
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._layoutCache = new LayoutCache({ maxSize: DEFAULT_CONFIG.LAYOUT_CACHE_MAX_SIZE || 5000 });
  }

  /**
   * 获取布局缓存实例
   */
  getLayoutCache() {
    return this._layoutCache;
  }

  setMode(mode) {
    this.mode = mode;
    this.container.dataset.layoutMode = mode;
    this._layoutCache.markAllDirty();
    this.applyLayout();
    this._eventBus.emit(EVENT_TYPES.LAYOUT_CHANGED, { mode });
  }

  getMode() {
    return this.mode;
  }

  applyLayout() {
    if (this.mode === 'stream') {
      this.container.classList.add('layout-stream');
      this.container.classList.remove('layout-canvas');
      this.container.style.position = '';
      this.container.style.transform = '';
      this._cleanupCanvasEvents();
    } else {
      this.container.classList.add('layout-canvas');
      this.container.classList.remove('layout-stream');
      this.container.style.position = 'relative';
      this._setupCanvasEvents();
      this.syncPositions();
    }
  }

  /**
   * 计算单张卡片的位置（带缓存）
   * 增量计算：仅对脏卡片重新计算
   */
  computeCardLayout(card) {
    if (!card) return null;
    const cached = this._layoutCache.get(card.id);
    if (cached && !this._layoutCache.isDirty(card.id)) {
      return cached;
    }
    const result = this._doComputeCardLayout(card);
    this._layoutCache.set(card.id, result);
    return result;
  }

  /**
   * 实际执行布局计算
   */
  _doComputeCardLayout(card) {
    // 流式模式：按顺序排布
    if (this.mode === 'stream') {
      return {
        mode: 'stream',
        x: 0,
        y: 'auto',
        width: '100%',
        height: 'auto'
      };
    }
    // 画布模式：使用 position
    return {
      mode: 'canvas',
      x: card.position?.x || 0,
      y: card.position?.y || 0,
      width: 'auto',
      height: 'auto',
      zoom: this.zoom,
      pan: { ...this.pan }
    };
  }

  /**
   * 批量计算布局（增量）
   */
  computeLayouts(cards) {
    if (!Array.isArray(cards)) return [];
    return cards.map(c => this.computeCardLayout(c));
  }

  /**
   * 通知某张卡片布局失效
   */
  invalidateLayout(cardId) {
    this._layoutCache.markDirty(cardId);
  }

  /**
   * 通知 Store 变更，标记所有相关卡片为脏
   */
  invalidateAll() {
    this._layoutCache.markAllDirty();
  }

  syncPositions() {
    if (this.mode !== 'canvas') return;

    const cards = this.store.getAllCards();
    cards.forEach(card => {
      const el = this.container.querySelector(`[data-card-id="${card.id}"]`);
      if (el && card.position) {
        el.style.position = 'absolute';
        el.style.left = card.position.x + 'px';
        el.style.top = card.position.y + 'px';
      }
    });
  }

  _setupCanvasEvents() {
    this._onWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.setZoom(this.zoom * delta, e.offsetX, e.offsetY);
      }
    };

    this._onMouseDown = (e) => {
      if (e.button !== 0) return;

      const cardEl = e.target.closest('.card');
      if (cardEl && !e.target.closest('button, input, textarea, [data-action]')) {
        this._startDrag(e, cardEl);
      } else if (e.target === this.container || e.target.classList.contains('card-container')) {
        this._startPan(e);
      }
    };

    this._onMouseMove = (e) => {
      if (this._isDragging) {
        this._updateDrag(e);
      } else if (this._isPanning) {
        this._updatePan(e);
      }
    };

    this._onMouseUp = () => {
      if (this._isDragging) {
        this._endDrag();
      } else if (this._isPanning) {
        this._endPan();
      }
    };

    this.container.addEventListener('wheel', this._onWheel, { passive: false });
    this.container.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  _cleanupCanvasEvents() {
    if (this._onWheel) {
      this.container.removeEventListener('wheel', this._onWheel);
      this.container.removeEventListener('mousedown', this._onMouseDown);
      document.removeEventListener('mousemove', this._onMouseMove);
      document.removeEventListener('mouseup', this._onMouseUp);
    }
  }

  _startDrag(e, cardEl) {
    const cardId = cardEl.dataset.cardId;
    const card = this.store.getCard(cardId);
    if (!card) return;

    this._isDragging = true;
    this._dragCard = card;
    cardEl.classList.add('card-dragging');

    const rect = cardEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    this._dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  _updateDrag(e) {
    if (!this._dragCard) return;

    const containerRect = this.container.getBoundingClientRect();
    const x = (e.clientX - containerRect.left - this._dragOffset.x - this.pan.x) / this.zoom;
    const y = (e.clientY - containerRect.top - this._dragOffset.y - this.pan.y) / this.zoom;

    this._dragCard.position = { x, y };

    const el = this.container.querySelector(`[data-card-id="${this._dragCard.id}"]`);
    if (el) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    }
  }

  _endDrag() {
    if (this._dragCard) {
      this.store.updateCard(this._dragCard);
      const el = this.container.querySelector(`[data-card-id="${this._dragCard.id}"]`);
      if (el) {
        el.classList.remove('card-dragging');
      }
    }
    this._isDragging = false;
    this._dragCard = null;
  }

  _startPan(e) {
    this._isPanning = true;
    this.container.style.cursor = 'grabbing';
    this._panStart = {
      x: e.clientX - this.pan.x,
      y: e.clientY - this.pan.y
    };
  }

  _updatePan(e) {
    this.pan.x = e.clientX - this._panStart.x;
    this.pan.y = e.clientY - this._panStart.y;
    this.container.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
  }

  _endPan() {
    this._isPanning = false;
    this.container.style.cursor = '';
  }

  setZoom(zoom, centerX, centerY) {
    const minZoom = 0.2;
    const maxZoom = 3;
    this.zoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    this.container.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
  }

  resetView() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.container.style.transform = '';
  }
}
