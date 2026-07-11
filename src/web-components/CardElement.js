/**
 * CardElement — custom element for declarative card definitions (<cf-card>).
 * @module web-components/CardElement
 */

import { Utils } from '../utils/Utils.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';
import { EVENT_TYPES } from '../utils/constants.js';

// Conditional base class — allows module to load in non-browser environments
const _HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class CardElement extends _HTMLElement {
  constructor(eventBus) {
    super();
    this._eventBus = eventBus;
    this._isMoving = false;
    this._isUpdating = false;
  }

  static get observedAttributes() {
    return ['type', 'title', 'priority', 'data-priority'];
  }

  _getFrame() {
    const frameEl = this.closest('.card-frame, card-frame');
    return frameEl ? (frameEl.__cardFrame || null) : null;
  }

  connectedCallback() {
    const frame = this._getFrame();

    if (!frame) {
      this._waitingForFrame = true;
      return;
    }

    this._initCard();
  }

  _initCard() {
    const frame = this._getFrame();
    if (!frame || this.dataset.cardId) return;

    const card = this.extractCardFromElement();
    const validation = frame.typeRegistry.validate(card);

    if (!validation.valid) {
      validation.errors.forEach(err => {
        FeedbackSystem.warn(
          err.message,
          err.type === 'allowedValues' ? `允许值：${err.allowedValues?.join(', ')}` : '',
          err.type === 'required' ? `<cf-card type="${card.type}" ${err.prop}="..."></cf-card>` : ''
        );
      });
      frame.autoFixer.fixCard(card, validation);
    }

    frame.store.addCard(card);
    this.dataset.cardId = card.id;
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this._isUpdating) return;

    const cardId = this.dataset.cardId;
    if (!cardId) return;

    const frame = this._getFrame();
    if (!frame) return;

    const card = frame.store.getCard(cardId);
    if (!card) return;

    const propName = name.startsWith('data-') ? name.slice(5) : name;

    const typeDef = frame.typeRegistry.get(card.type);
    if (typeDef) {
      const propSchema = typeDef.propsSchema.find(p => p.name === propName);
      if (propSchema) {
        if (newValue !== undefined && newValue !== '' && !Utils.validateType(newValue, propSchema.type)) {
          FeedbackSystem.warn(
            `属性 "${propName}" 类型错误`,
            `期望类型：${propSchema.type}`,
            `正确的 ${propSchema.type} 类型值`
          );
          if (oldValue) {
            this.setAttribute(name, oldValue);
          } else {
            this.removeAttribute(name);
          }
          this._eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, {
            cardId,
            propName,
            error: 'type error'
          });
          return;
        }

        if (newValue !== undefined && newValue !== '' && propSchema.allowedValues && !propSchema.allowedValues.includes(newValue)) {
          FeedbackSystem.warn(
            `属性 "${propName}" 值 "${newValue}" 不在允许列表中`,
            `已自动设置为默认值：${propSchema.defaultValue}`,
            `允许值：${propSchema.allowedValues.join(', ')}`
          );
          if (propSchema.defaultValue !== undefined) {
            this.setAttribute(name, String(propSchema.defaultValue));
          }
          this._eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, {
            cardId,
            propName,
            error: 'value not allowed'
          });
          return;
        }
      } else {
        FeedbackSystem.info(
          `未知属性 "${propName}"`,
          `标准属性：${typeDef.propsSchema.map(p => p.name).join(', ')}`,
          '建议使用标准属性或扩展卡片类型'
        );
      }
    }

    card.props[propName] = newValue;
    frame.store.updateCard(card);

    this._isUpdating = true;
    this.render();
    this._isUpdating = false;
  }

  disconnectedCallback() {
    const cardId = this.dataset.cardId;
    if (cardId && !this._isMoving) {
      const frame = this._getFrame();
      if (frame) {
        frame.store.removeCard(cardId);
      }
    }
  }

  extractCardFromElement() {
    const props = {};

    for (const attr of this.attributes) {
      if (attr.name.startsWith('data-')) {
        const key = attr.name.slice(5);
        props[key] = attr.value;
      } else if (!['type', 'id', 'class'].includes(attr.name)) {
        props[attr.name] = attr.value;
      }
    }

    if (this.innerHTML.trim()) {
      props.content = this.innerHTML.trim();
    }

    return {
      id: this.id || Utils.generateId('card'),
      type: this.getAttribute('type') || 'text',
      props,
      position: { x: 0, y: 0 },
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  render() {
    const cardId = this.dataset.cardId;
    if (!cardId) return;

    const frame = this._getFrame();
    if (!frame) return;

    const card = frame.store.getCard(cardId);
    if (!card) return;

    const rendered = frame.renderer.renderCard(card);
    this.innerHTML = rendered.innerHTML;
    this.className = rendered.className;
    for (let i = rendered.attributes.length - 1; i >= 0; i--) {
      const attr = rendered.attributes[i];
      if (attr.name !== 'id') {
        this.setAttribute(attr.name, attr.value);
      }
    }
  }
}
