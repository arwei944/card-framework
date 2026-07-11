/**
 * RelationshipEngine manages visual relationship lines between cards on the canvas.
 * Handles SVG rendering, drag-to-create interactions, tooltips, and editing.
 * @module extras/RelationshipEngine
 */

import { Utils } from '../utils/Utils.js';
import { Security } from '../security/Security.js';

export class RelationshipEngine {
  constructor(container, store, eventBus) {
    this.container = container;
    this.store = store;
    this._eventBus = eventBus;
    this.svg = null;
    this._enabled = false;
    this._interactionEnabled = false;
    this._renderDebounced = Utils.debounce(() => this._renderLines(), 50);
    this._dragState = null;
    this._tempLine = null;
    this._handles = new Map();
    this._hoveredRelationship = null;
    this._defaultRelationType = 'reference';
  }

  enable() {
    if (this._enabled) return;
    this._enabled = true;
    this._createSvgLayer();
    this._setupListeners();
    this._renderLines();
    if (this._interactionEnabled) {
      this._createHandles();
      this._setupInteractionListeners();
    }
  }

  disable() {
    if (!this._enabled) return;
    this._enabled = false;
    this._removeSvgLayer();
    this._cleanupListeners();
    if (this._interactionEnabled) {
      this._removeHandles();
      this._cleanupInteractionListeners();
    }
    this._cancelDrag();
  }

  isEnabled() {
    return this._enabled;
  }

  enableInteraction() {
    if (this._interactionEnabled) return;
    this._interactionEnabled = true;
    if (this._enabled) {
      this._createHandles();
      this._setupInteractionListeners();
    }
  }

  disableInteraction() {
    if (!this._interactionEnabled) return;
    this._interactionEnabled = false;
    this._removeHandles();
    this._cleanupInteractionListeners();
    this._cancelDrag();
  }

  isInteractionEnabled() {
    return this._interactionEnabled;
  }

  setDefaultRelationType(type) {
    this._defaultRelationType = type;
  }

  _createSvgLayer() {
    if (this.svg) return;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '0';
    svg.classList.add('relationship-svg');

    // 定义箭头 marker
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ['reference', 'parent', 'child', 'dependency', 'related'].forEach(type => {
      const color = this._getRelationshipColor(type);
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', `arrow-${type}`);
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '8');
      marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '6');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      polygon.setAttribute('points', '0 0, 10 5, 0 10');
      polygon.setAttribute('fill', color);
      marker.appendChild(polygon);
      defs.appendChild(marker);
    });
    svg.appendChild(defs);

    this.container.style.position = 'relative';
    this.container.insertBefore(svg, this.container.firstChild);
    this.svg = svg;
  }

  _removeSvgLayer() {
    if (this.svg && this.svg.parentNode) {
      this.svg.parentNode.removeChild(this.svg);
    }
    this.svg = null;
  }

  _setupListeners() {
    this._unsubscribe = this.store.subscribe(() => {
      this._renderDebounced();
    });
  }

  _cleanupListeners() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  _renderLines() {
    if (!this._enabled || !this.svg) return;

    this.svg.innerHTML = '';

    const relationships = this.store.getAllRelationships();
    const cards = this.store.getAllCards();
    const cardMap = new Map(cards.map(c => [c.id, c]));

    relationships.forEach(rel => {
      const sourceCard = cardMap.get(rel.sourceId);
      const targetCard = cardMap.get(rel.targetId);

      if (!sourceCard || !targetCard) return;

      const sourceEl = this.container.querySelector(`[data-card-id="${rel.sourceId}"]`);
      const targetEl = this.container.querySelector(`[data-card-id="${rel.targetId}"]`);

      if (!sourceEl || !targetEl) return;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      // 智能端点选择：从源卡片中心指向目标卡片中心
      const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const x2 = targetRect.left + targetRect.width / 2 - containerRect.left;
      const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

      const line = this._createLine(rel, x1, y1, x2, y2);
      this.svg.appendChild(line);
    });

    if (this._interactionEnabled) {
      this._updateHandles();
    }
  }

  /**
   * 平滑更新连线（用于拖拽卡片时）
   * 与 _renderLines 不同，_updateLines 使用 transition 平滑过渡
   */
  _updateLines() {
    if (!this._enabled || !this.svg) return;

    const relationships = this.store.getAllRelationships();
    const cards = this.store.getAllCards();
    const cardMap = new Map(cards.map(c => [c.id, c]));

    relationships.forEach(rel => {
      const sourceCard = cardMap.get(rel.sourceId);
      const targetCard = cardMap.get(rel.targetId);
      if (!sourceCard || !targetCard) return;

      const sourceEl = this.container.querySelector(`[data-card-id="${rel.sourceId}"]`);
      const targetEl = this.container.querySelector(`[data-card-id="${rel.targetId}"]`);
      if (!sourceEl || !targetEl) return;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const containerRect = this.container.getBoundingClientRect();

      const x1 = sourceRect.left + sourceRect.width / 2 - containerRect.left;
      const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top;
      const x2 = targetRect.left + targetRect.width / 2 - containerRect.left;
      const y2 = targetRect.top + targetRect.height / 2 - containerRect.top;

      // 平滑更新 path
      const group = this.svg.querySelector(`g[data-relationship-id="${rel.id}"]`);
      if (group) {
        const path = group.querySelector('.relationship-line');
        if (path) {
          const dx = Math.abs(x2 - x1);
          const dy = Math.abs(y2 - y1);
          const controlOffset = Math.min(dx, dy) * 0.5;
          let d;
          if (x1 < x2) {
            d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
          } else {
            d = `M ${x1} ${y1} C ${x1 - controlOffset} ${y1}, ${x2 + controlOffset} ${y2}, ${x2} ${y2}`;
          }
          path.setAttribute('d', d);
          // 平滑过渡
          path.style.transition = 'd 0.15s ease';
        }
      }
    });
  }

  _createLine(rel, x1, y1, x2, y2) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const controlOffset = Math.min(dx, dy) * 0.5;

    let d;
    if (x1 < x2) {
      d = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
    } else {
      d = `M ${x1} ${y1} C ${x1 - controlOffset} ${y1}, ${x2 + controlOffset} ${y2}, ${x2} ${y2}`;
    }

    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', this._getRelationshipColor(rel.type));
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', this._getStrokeStyle(rel.type));
    path.setAttribute('marker-end', `url(#arrow-${rel.type})`);
    path.setAttribute('class', `relationship-line relationship-type-${rel.type}`);
    path.style.pointerEvents = 'stroke';
    path.style.cursor = 'pointer';
    path.dataset.relationshipId = rel.id;

    path.addEventListener('click', (e) => {
      e.stopPropagation();
      this._eventBus.emit('relationshipClick', { relationship: rel, event: e });
    });

    path.addEventListener('mouseenter', (e) => {
      path.setAttribute('stroke-width', '3');
      if (this._interactionEnabled) {
        this._showRelationshipTooltip(rel, e);
      }
    });

    path.addEventListener('mouseleave', () => {
      path.setAttribute('stroke-width', '2');
      this._hideRelationshipTooltip();
    });

    if (this._interactionEnabled) {
      path.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this._editRelationshipType(rel);
      });

      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._deleteRelationship(rel);
      });
    }

    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.dataset.relationshipId = rel.id;
    // 渐入动画（新创建的关系）
    group.classList.add('appearing');
    setTimeout(() => group.classList.remove('appearing'), 300);
    group.appendChild(path);

    if (rel.type) {
      const labelText = rel.type;
      const labelPadding = 6;
      const labelWidth = Math.max(labelText.length * 7, 30);
      const labelHeight = 16;

      // 标签背景（圆角矩形）
      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      labelBg.setAttribute('x', midX - labelWidth / 2);
      labelBg.setAttribute('y', midY - labelHeight / 2 - 5);
      labelBg.setAttribute('width', labelWidth);
      labelBg.setAttribute('height', labelHeight);
      labelBg.setAttribute('rx', '8');
      labelBg.setAttribute('ry', '8');
      labelBg.setAttribute('class', 'relationship-label-bg');
      labelBg.style.pointerEvents = 'auto';
      labelBg.style.cursor = 'pointer';
      group.appendChild(labelBg);

      // 标签文字
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', midX);
      label.setAttribute('y', midY - 5 + 4);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'relationship-label');
      label.textContent = labelText;
      label.style.pointerEvents = 'auto';
      label.style.cursor = 'pointer';
      group.appendChild(label);

      // 双击标签编辑关系类型
      if (this._interactionEnabled) {
        const editHandler = (e) => {
          e.stopPropagation();
          this._editRelationshipType(rel);
        };
        label.addEventListener('dblclick', editHandler);
        labelBg.addEventListener('dblclick', editHandler);
      }
    }

    return group;
  }

  _getRelationshipColor(type) {
    const colors = {
      reference: '#3b82f6',
      parent: '#22c55e',
      child: '#f59e0b',
      dependency: '#ef4444',
      related: '#8b5cf6'
    };
    return colors[type] || '#999999';
  }

  _getStrokeStyle(type) {
    const styles = {
      reference: 'none',
      parent: 'none',
      child: '5,5',
      dependency: '2,2',
      related: '8,4'
    };
    return styles[type] || 'none';
  }

  _createHandles() {
    const cards = this.store.getAllCards();
    cards.forEach(card => {
      this._createHandle(card.id);
    });
  }

  _createHandle(cardId) {
    if (this._handles.has(cardId)) return;

    const cardEl = this.container.querySelector(`[data-card-id="${cardId}"]`);
    if (!cardEl) return;

    const handle = document.createElement('div');
    handle.className = 'relationship-handle';
    handle.dataset.cardId = cardId;
    handle.title = '拖拽创建关系';
    handle.style.position = 'absolute';
    handle.style.right = '-8px';
    handle.style.top = '50%';
    handle.style.transform = 'translateY(-50%)';
    handle.style.width = '16px';
    handle.style.height = '16px';
    handle.style.borderRadius = '50%';
    handle.style.background = '#3b82f6';
    handle.style.border = '2px solid white';
    handle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    handle.style.cursor = 'crosshair';
    handle.style.zIndex = '10';
    handle.style.opacity = '0';
    handle.style.transition = 'opacity 0.2s ease';
    handle.style.pointerEvents = 'auto';

    cardEl.style.position = cardEl.style.position || 'relative';
    cardEl.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this._startDragFromHandle(cardId, e);
    });

    cardEl.addEventListener('mouseenter', () => {
      if (this._interactionEnabled) {
        handle.style.opacity = '1';
      }
    });

    cardEl.addEventListener('mouseleave', () => {
      if (!this._dragState) {
        handle.style.opacity = '0';
      }
    });

    this._handles.set(cardId, handle);
  }

  _removeHandles() {
    this._handles.forEach(handle => {
      if (handle.parentNode) {
        handle.parentNode.removeChild(handle);
      }
    });
    this._handles.clear();
  }

  _updateHandles() {
    const cardIds = new Set(this.store.getAllCards().map(c => c.id));

    this._handles.forEach((handle, cardId) => {
      if (!cardIds.has(cardId)) {
        if (handle.parentNode) {
          handle.parentNode.removeChild(handle);
        }
        this._handles.delete(cardId);
      }
    });

    cardIds.forEach(cardId => {
      if (!this._handles.has(cardId)) {
        this._createHandle(cardId);
      }
    });
  }

  _startDragFromHandle(sourceCardId, e) {
    const sourceEl = this.container.querySelector(`[data-card-id="${sourceCardId}"]`);
    if (!sourceEl) return;

    const sourceRect = sourceEl.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    this._dragState = {
      sourceCardId,
      startX: sourceRect.right - containerRect.left,
      startY: sourceRect.top + sourceRect.height / 2 - containerRect.top
    };

    this._createTempLine(this._dragState.startX, this._dragState.startY, this._dragState.startX, this._dragState.startY);

    document.addEventListener('mousemove', this._onDragMove);
    document.addEventListener('mouseup', this._onDragEnd);
  }

  _createTempLine(x1, y1, x2, y2) {
    if (!this.svg) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#3b82f6');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '5,5');
    path.setAttribute('class', 'temp-relationship-line');
    path.style.pointerEvents = 'none';

    this.svg.appendChild(path);
    this._tempLine = path;
  }

  _updateTempLine(x2, y2) {
    if (!this._tempLine || !this._dragState) return;
    this._tempLine.setAttribute('d', `M ${this._dragState.startX} ${this._dragState.startY} L ${x2} ${y2}`);
  }

  _onDragMove = (e) => {
    if (!this._dragState || !this.svg) return;

    const containerRect = this.container.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    this._updateTempLine(x, y);

    const targetCardEl = e.target.closest('[data-card-id]');
    if (targetCardEl) {
      const targetId = targetCardEl.dataset.cardId;
      if (targetId !== this._dragState.sourceCardId) {
        targetCardEl.classList.add('card-relationship-target');
        this._dragState.targetCardId = targetId;
      }
    } else {
      if (this._dragState.targetCardId) {
        const prevTarget = this.container.querySelector(`[data-card-id="${this._dragState.targetCardId}"]`);
        if (prevTarget) {
          prevTarget.classList.remove('card-relationship-target');
        }
        this._dragState.targetCardId = null;
      }
    }
  };

  _onDragEnd = (e) => {
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);

    if (!this._dragState) return;

    if (this._dragState.targetCardId && this._dragState.targetCardId !== this._dragState.sourceCardId) {
      this.store.addRelationship({
        sourceId: this._dragState.sourceCardId,
        targetId: this._dragState.targetCardId,
        type: this._defaultRelationType
      });
      this._eventBus.emit('relationshipCreatedByDrag', {
        sourceId: this._dragState.sourceCardId,
        targetId: this._dragState.targetCardId,
        type: this._defaultRelationType
      });
    }

    if (this._dragState.targetCardId) {
      const targetEl = this.container.querySelector(`[data-card-id="${this._dragState.targetCardId}"]`);
      if (targetEl) {
        targetEl.classList.remove('card-relationship-target');
      }
    }

    this._cancelDrag();
  };

  _cancelDrag() {
    if (this._tempLine && this._tempLine.parentNode) {
      this._tempLine.parentNode.removeChild(this._tempLine);
    }
    this._tempLine = null;
    this._dragState = null;
  }

  _setupInteractionListeners() {
    this._onStoreChangeForInteraction = () => {
      if (this._interactionEnabled) {
        this._updateHandles();
      }
    };
    this.store.subscribe(this._onStoreChangeForInteraction);
  }

  _cleanupInteractionListeners() {
    if (this._onStoreChangeForInteraction) {
      this.store.unsubscribe(this._onStoreChangeForInteraction);
      this._onStoreChangeForInteraction = null;
    }
    document.removeEventListener('mousemove', this._onDragMove);
    document.removeEventListener('mouseup', this._onDragEnd);
  }

  _showRelationshipTooltip(rel, e) {
    this._hideRelationshipTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'relationship-tooltip';
    tooltip.style.position = 'fixed';
    tooltip.style.left = e.clientX + 10 + 'px';
    tooltip.style.top = e.clientY + 10 + 'px';
    tooltip.style.background = 'rgba(0,0,0,0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.zIndex = '10000';
    tooltip.style.pointerEvents = 'none';

    const sourceCard = this.store.getCard(rel.sourceId);
    const targetCard = this.store.getCard(rel.targetId);

    const typeText = Security.escapeHtml(String(rel.type ?? ''));
    const sourceText = Security.escapeHtml(String(sourceCard?.props?.title || rel.sourceId));
    const targetText = Security.escapeHtml(String(targetCard?.props?.title || rel.targetId));

    tooltip.innerHTML = `
      <div><strong>关系类型:</strong> ${typeText}</div>
      <div><strong>源:</strong> ${sourceText}</div>
      <div><strong>目标:</strong> ${targetText}</div>
      <div style="margin-top: 4px; font-size: 11px; opacity: 0.8;">双击编辑类型 · 右键删除</div>
    `;

    document.body.appendChild(tooltip);
    this._tooltip = tooltip;
  }

  _hideRelationshipTooltip() {
    if (this._tooltip && this._tooltip.parentNode) {
      this._tooltip.parentNode.removeChild(this._tooltip);
    }
    this._tooltip = null;
  }

  _editRelationshipType(rel) {
    const types = ['reference', 'parent', 'child', 'dependency', 'related'];
    const typeLabels = {
      reference: '引用',
      parent: '父级',
      child: '子级',
      dependency: '依赖',
      related: '关联'
    };

    const typeList = types.map((t, i) => `${i + 1}. ${typeLabels[t]} (${t})`).join('\n');
    const prompt = `选择关系类型:\n${typeList}\n\n请输入序号 (1-${types.length}):`;

    const result = window.prompt(prompt, types.indexOf(rel.type) + 1);
    if (result === null) return;

    const index = parseInt(result) - 1;
    if (index >= 0 && index < types.length) {
      const updatedRel = { ...rel, type: types[index] };
      this.store.updateRelationship(updatedRel);
      this._eventBus.emit('relationshipTypeChanged', { relationshipId: rel.id, oldType: rel.type, newType: types[index] });
    }
  }

  _deleteRelationship(rel) {
    if (confirm(`确定删除此关系吗？\n类型: ${rel.type}`)) {
      this.store.removeRelationship(rel.id);
      this._eventBus.emit('relationshipDeletedByContext', { relationshipId: rel.id });
    }
  }

  refresh() {
    this._renderLines();
  }
}
