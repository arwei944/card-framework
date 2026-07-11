/**
 * CardFrameElement — custom element for the card framework container (<card-frame>).
 * @module web-components/CardFrameElement
 */

import { Store } from '../core/Store.js';
import { TypeRegistry } from '../core/TypeRegistry.js';
import { defaultCardTypes } from '../core/defaultCardTypes.js';
import { EventBus } from '../core/EventBus.js';
import { Renderer } from '../render/Renderer.js';
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
        eventBus: localEventBus,
        store: localStore,
        typeRegistry: localTypeRegistry,
        renderer: localRenderer,
        autoFixer: localAutoFixer,
        realTimeValidator: localValidator
      };
      this.__cardFrame = frame;

      this._initPendingCards();
      localValidator.start();

      localStore.subscribe(() => {
        this.syncCards();
      });

      this.syncCards();
    }
  }

  /**
   * T7.01 — resolve the race where a <cf-card> upgrades/connects before its
   * parent <card-frame>. Any such element parked itself (_waitingForFrame) and
   * is initialized here now that the frame context exists.
   */
  _initPendingCards() {
    const cardEls = this.querySelectorAll('cf-card');
    cardEls.forEach(el => {
      if (typeof el._initCard === 'function') {
        el._initCard();
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
