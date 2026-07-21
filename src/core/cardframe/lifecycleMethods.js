/**
 * Lifecycle / destroy mixed into CardFrame.prototype.
 * @module core/cardframe/lifecycleMethods
 */

export const lifecycleMethods = {
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this.renderer && this.renderer._rafId != null) {
      cancelAnimationFrame(this.renderer._rafId);
      this.renderer._rafId = null;
    }

    if (this.evolutionEngine) {
      this.evolutionEngine.stop();
      this.evolutionEngine = null;
    }

    if (this.realTimeValidator) {
      this.realTimeValidator.stop();
    }

    if (this.guardrail) {
      this.guardrail.destroy();
      this.guardrail = null;
    }

    if (this.perfPanel) {
      this.perfPanel.disable();
    }

    if (this.globalErrorHandler) {
      this.globalErrorHandler.disable();
    }

    if (this.virtualScroller) {
      this.virtualScroller.destroy();
    }

    if (this.relationshipEngine) {
      this.relationshipEngine.disable();
    }

    if (this.eventBus) {
      this.eventBus.clear();
    }

    if (this.cardObjectPool && typeof this.cardObjectPool.clear === 'function') {
      this.cardObjectPool.clear();
    }

    if (this.store && typeof this.store.destroy === 'function') {
      this.store.destroy();
    }

    if (this.container) {
      this.container.classList.remove('card-frame');
      this.container.innerHTML = '';
      if (this.container.__cardFrame === this) {
        delete this.container.__cardFrame;
      }
    }

    this.renderer = null;
    this.layoutEngine = null;
    this.realTimeValidator = null;
    this.pluginManager = null;
    this.globalErrorHandler = null;
    this.perfPanel = null;
    this.cardObjectPool = null;
    this.themeManager = null;
    this.i18n = null;
    this.relationshipEngine = null;
    this.virtualScroller = null;
    this.eventBus = null;
  }
};
