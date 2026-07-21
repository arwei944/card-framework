/**
 * CardFrameElement — custom element for the card framework container (<card-frame>).
 *
 * B2/B3 Fix: Now delegates to the CardFrame class for unified initialization,
 * ensuring both JS API and declarative HTML entry points share identical behavior.
 * Added disconnectedCallback for proper resource cleanup.
 *
 * @module web-components/CardFrameElement
 */

import { CardFrame } from '../core/CardFrame.js';

// Conditional base class — allows module to load in non-browser environments
const _HTMLElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class CardFrameElement extends _HTMLElement {
  connectedCallback() {
    if (!this._initialized) {
      this._initialized = true;

      // Delegate to CardFrame class — unified initialization
      this._frame = new CardFrame(this);

      // Initialize any <cf-card> children that connected before this element
      this._initPendingCards();
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

  /**
   * B3 Fix: Properly clean up all resources when the custom element is
   * removed from the DOM, preventing memory leaks.
   */
  disconnectedCallback() {
    if (this._frame) {
      this._frame.destroy();
      this._frame = null;
    }
  }
}