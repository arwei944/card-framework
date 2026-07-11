/**
 * CardFrameElement — custom element for the card framework container (<card-frame>).
 * @module web-components/CardFrameElement
 */

import { Store } from '../core/Store.js';
import { TypeRegistry } from '../core/TypeRegistry.js';
import { defaultCardTypes } from '../core/defaultCardTypes.js';
import { EventBus } from '../core/EventBus.js';
import { Renderer } from '../render/Renderer.js';
import { Utils } from '../utils/Utils.js';
import { AutoFixer } from '../validation/AutoFixer.js';
import { RealTimeValidator } from '../validation/RealTimeValidator.js';

// Conditional base class — allows module to load in non-browser environments
const _HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class CardFrameElement extends _HTMLElement {
  connectedCallback() {
    if (!this._initialized) {
      this._initialized = true;
      this.classList.add('card-frame');

      const localEventBus = new EventBus();
      const localStore = new Store(localEventBus);
      const localTypeRegistry = new TypeRegistry();
      defaultCardTypes.forEach(t => localTypeRegistry.register(t));
      const localRenderer = new Renderer(this, localTypeRegistry, localStore, localEventBus);
      const localAutoFixer = new AutoFixer(localTypeRegistry, localStore, this, localEventBus);
      const localValidator = new RealTimeValidator(this, localTypeRegistry, localStore, localAutoFixer, localEventBus);

      this._store = localStore;
      this._renderer = localRenderer;
      this._autoFixer = localAutoFixer;
      this._validator = localValidator;

      const frame = {
        store: localStore,
        typeRegistry: localTypeRegistry,
        renderer: localRenderer,
        autoFixer: localAutoFixer,
        realTimeValidator: localValidator
      };
      this.__cardFrame = frame;

      this._initFromDOM();
      localValidator.start();

      localStore.subscribe(() => {
        this.syncCards();
      });

      this.syncCards();
    }
  }

  _initFromDOM() {
    const cardEls = this.querySelectorAll('cf-card');
    const localStore = this._store;
    const localAutoFixer = this._autoFixer;
    cardEls.forEach(el => {
      if (!el.dataset.cardId) {
        const props = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) {
            const key = attr.name.slice(5);
            props[key] = Utils.parseValue(attr.value);
          } else if (!['type', 'id', 'class'].includes(attr.name)) {
            props[attr.name] = Utils.parseValue(attr.value);
          }
        }

        if (el.innerHTML.trim()) {
          props.content = el.innerHTML.trim();
        }

        const card = {
          id: el.id || Utils.generateId('card'),
          type: el.getAttribute('type') || 'text',
          props,
          position: { x: 0, y: 0 },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const validation = localTypeRegistry.validate(card);
        if (!validation.valid) {
          localAutoFixer.fixCard(card, validation);
        }

        localStore.addCard(card);
        el.dataset.cardId = card.id;
      }
    });
  }

  syncCards() {
    const cards = this._store.getAllCards();
    if (this._renderer) {
      this._renderer.renderCards(cards);
    }
  }
}
