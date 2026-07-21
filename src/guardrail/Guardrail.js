/**
 * Guardrail — hard constraint system for AI Agent integration
 *
 * Prevents agents from falling back to vanilla HTML / Tailwind / direct DOM
 * manipulation when using CardFrame. Detects four classes of "escape" usage
 * inside <card-frame> containers and reports them with fix suggestions.
 *
 * Rules:
 *   R1 (warn)  — non-card elements inside container (e.g. <div class="card">)
 *   R2 (info)  — escape CSS framework classes (Tailwind/Bootstrap/Bulma)
 *   R3 (error) — direct DOM manipulation (appendChild/innerHTML on container)
 *   R4 (error) — bypassing Store via private field access (frame.store._*)
 *
 * Scope: only inspects elements INSIDE the CardFrame container. Page header,
 * nav, footer outside the container are free to use any technology.
 *
 * Configurable via options.guardrail; disabled with options.guardrail: false.
 */

const ALLOWED_TAG_NAMES = new Set([
  'CF-CARD',
  'CF-SHADOW-CARD',
  'CARD-FRAME',
  'TEMPLATE',
  'SCRIPT',
  'STYLE',
  'LINK'
]);

const TAILWIND_PATTERNS = [
  /^(flex|grid|block|inline|hidden|inline-block|inline-flex|inline-grid)$/,
  /^(p|m|px|py|mx|my|pt|pb|pl|pr|mt|mb|ml|mr|gap|space-x|space-y)-/,
  /^(text|bg|border|border-b|border-t|border-l|border-r|rounded|shadow|w|h|min-w|min-h|max-w|max-h)-/,
  /^(justify|items|self|place|overflow|overflow-x|overflow-y)-/,
  /^(font|leading|tracking|z)-/,
  /^(absolute|relative|fixed|sticky|static)$/,
  /^(sm|md|lg|xl|2xl):/
];

const BOOTSTRAP_PATTERNS = [
  /^(col|row|container|btn|card|alert|badge|d-|text-|bg-|m-|p-|mb-|mt-|ml-|mr-|pb-|pt-|pl-|pr-|w-|h-)/,
  /^(navbar|nav|dropdown|modal|carousel|accordion|tab|tooltip|popover)/
];

const BULMA_PATTERNS = [
  /^(column|columns|is-|has-|tile|box|button|notification|message|tag|tags|level|breadcrumb|menu|panel)/
];

const SEVERITY_ORDER = { error: 0, warn: 1, info: 2 };

export class Guardrail {
  constructor(frame, options = {}) {
    this.frame = frame;
    this.container = frame.container;

    const opts = options === true ? {} : (options || {});
    this.enabled = opts.enabled !== false;
    this.level = opts.level || 'warn';
    this.onViolation = typeof opts.onViolation === 'function' ? opts.onViolation : null;
    this.excludedFrameworks = new Set(opts.excludedFrameworks || []);
    this.testMode = opts.testMode === true;

    this._violations = [];
    this._observer = null;
    this._domHijacked = false;
    this._originalAppendChild = null;
    this._originalInsertBefore = null;
    this._originalInnerHTML = null;
    this._storeProxy = null;
    this._destroyed = false;

    // If level is 'error', suppress warn/info; if 'warn', suppress info
    this._minSeverity = SEVERITY_ORDER[this.level] !== undefined
      ? SEVERITY_ORDER[this.level]
      : SEVERITY_ORDER.warn;
  }

  /**
   * Initial scan of container's existing children.
   * Catches escape usages present in declarative HTML before JS ran.
   */
  scan() {
    if (!this.enabled || this._destroyed) return;
    const children = this.container.children;
    for (const child of children) {
      this._checkNode(child);
    }
  }

  /**
   * Start MutationObserver to catch future escape usages.
   */
  observe() {
    if (!this.enabled || this._destroyed || this._observer) return;

    this._observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            this._checkNode(node);
          }
        }
      }
    });

    this._observer.observe(this.container, {
      childList: true,
      subtree: false
    });

    this._hijackDOMAPI();
    this._proxyStore();
  }

  /**
   * Stop monitoring and restore original DOM APIs.
   */
  disconnect() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    this._restoreDOMAPI();
    this._unproxyStore();
  }

  /**
   * Destroy — alias for disconnect + prevent reuse.
   */
  destroy() {
    this.disconnect();
    this._destroyed = true;
  }

  // ─── Detection ──────────────────────────────────────────

  _checkNode(node) {
    if (!node || this._destroyed) return;

    // Skip text nodes and comments
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.COMMENT_NODE) return;

    // Only inspect Element nodes
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const tag = node.tagName;

    // Skip framework-internal elements (Renderer may add <template>, <style>, etc.)
    if (ALLOWED_TAG_NAMES.has(tag)) {
      return;
    }

    // Skip elements created by the framework Renderer (card wrappers have data-card-id)
    if (node.dataset && node.dataset.cardId) {
      return;
    }

    // R1: Non-card element inside container
    this._report({
      rule: 'R1',
      severity: 'warn',
      message: `容器内发现非卡片元素 <${tag.toLowerCase()}>`,
      element: this._describeElement(node),
      suggestion: '改用 <cf-card type="text"> 或其他卡片类型'
    });

    // R2: Escape CSS framework classes
    this._checkCSSClasses(node);
  }

  _checkCSSClasses(element) {
    const classList = element.classList;
    if (!classList || classList.length === 0) return;

    const found = { tailwind: [], bootstrap: [], bulma: [] };

    for (const cls of classList) {
      if (!this.excludedFrameworks.has('tailwind')) {
        for (const pattern of TAILWIND_PATTERNS) {
          if (pattern.test(cls)) { found.tailwind.push(cls); break; }
        }
      }
      if (!this.excludedFrameworks.has('bootstrap')) {
        for (const pattern of BOOTSTRAP_PATTERNS) {
          if (pattern.test(cls)) { found.bootstrap.push(cls); break; }
        }
      }
      if (!this.excludedFrameworks.has('bulma')) {
        for (const pattern of BULMA_PATTERNS) {
          if (pattern.test(cls)) { found.bulma.push(cls); break; }
        }
      }
    }

    for (const [framework, classes] of Object.entries(found)) {
      if (classes.length === 0) continue;
      this._report({
        rule: 'R2',
        severity: 'info',
        message: `容器内元素使用了 ${framework} CSS 框架: ${classes.join(', ')}`,
        element: this._describeElement(element),
        suggestion: '移除原子 CSS class，使用卡片 props（如 frame.createCard("text", { title })）控制布局'
      });
    }
  }

  // ─── DOM API hijacking (R3) ─────────────────────────────

  _hijackDOMAPI() {
    if (this._domHijacked) return;
    this._domHijacked = true;

    const self = this;
    const container = this.container;

    this._originalAppendChild = container.appendChild.bind(container);
    container.appendChild = function(node) {
      self._checkNode(node);
      return self._originalAppendChild(node);
    };

    this._originalInsertBefore = container.insertBefore.bind(container);
    container.insertBefore = function(node, ref) {
      self._checkNode(node);
      return self._originalInsertBefore(node, ref);
    };

    // innerHTML setter
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (desc && desc.set) {
      this._originalInnerHTML = desc.set;
      Object.defineProperty(container, 'innerHTML', {
        get() { return desc.get.call(this); },
        set(value) {
          // Parse and check before actually setting
          const temp = document.createElement('div');
          temp.innerHTML = value;
          for (const child of temp.children) {
            self._checkNode(child);
          }
          desc.set.call(this, value);
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  _restoreDOMAPI() {
    if (!this._domHijacked) return;
    this._domHijacked = false;

    if (this._originalAppendChild) {
      this.container.appendChild = this._originalAppendChild;
      this._originalAppendChild = null;
    }
    if (this._originalInsertBefore) {
      this.container.insertBefore = this._originalInsertBefore;
      this._originalInsertBefore = null;
    }
    if (this._originalInnerHTML) {
      delete this.container.innerHTML;
      this._originalInnerHTML = null;
    }
  }

  // ─── Store proxy (R4) ───────────────────────────────────

  _proxyStore() {
    if (this._storeProxy) return;
    const store = this.frame.store;
    if (!store) return;

    const self = this;
    this._storeProxy = store;

    // R4: Intercept private field access on the Store instance itself.
    // Works for both Map-based fields (cards, relationships) and any other private field.
    const PRIVATE_FIELDS = new Set([
      'cards', 'relationships', '_index', '_pool', '_eventBus',
      '_relIndex', '_notifyTimer', '_snapshotCache', 'listeners'
    ]);

    try {
      const handler = {
        get(target, prop) {
          if (typeof prop === 'string' && (prop.startsWith('_') || PRIVATE_FIELDS.has(prop))) {
            // Allow framework-internal access from CardFrame itself
            const stack = new Error().stack || '';
            const isInternal = stack.includes('CardFrame') || stack.includes('Renderer') ||
              stack.includes('AutoFixer') || stack.includes('RealTimeValidator') ||
              stack.includes('LayoutEngine') || stack.includes('RelationshipEngine');
            if (!isInternal) {
              self._report({
                rule: 'R4',
                severity: 'error',
                message: `直接访问 Store 私有字段 store.${prop}`,
                element: `frame.store.${prop}`,
                suggestion: '改用 frame.createCard() / frame.getCard() / frame.getAllCards() 等 Store API'
              });
            }
          }
          return Reflect.get(target, prop);
        }
      };
      this._originalStore = store;
      // Store proxy target reference for unproxy
      store.__guardrailTarget = store;
      this._storeProxyHandler = handler;
    } catch {
      // Proxy may fail on some platforms — silently skip
    }
  }

  _unproxyStore() {
    if (!this._storeProxy) return;
    this._storeProxy = null;
    this._storeProxyHandler = null;
    this._originalStore = null;
  }

  // ─── Reporting ──────────────────────────────────────────

  _report(violation) {
    violation.timestamp = Date.now();
    this._violations.push(violation);

    // Level filter
    const sev = SEVERITY_ORDER[violation.severity];
    if (sev === undefined || sev > this._minSeverity) return;

    // Notify via callback
    if (this.onViolation) {
      try { this.onViolation(violation); } catch { /* ignore callback errors */ }
    }

    // console output (skip in testMode)
    if (this.testMode) return;

    const prefix = `[CardFrame Guardrail ${violation.rule}]`;
    const detail = `${violation.message}\n  元素: ${violation.element}\n  建议: ${violation.suggestion}`;

    if (violation.severity === 'error') {
      console.error(`${prefix} ${detail}`);
    } else if (violation.severity === 'warn') {
      console.warn(`${prefix} ${detail}`);
    } else {
      console.info(`${prefix} ${detail}`);
    }
  }

  _describeElement(element) {
    const tag = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const cls = element.className && typeof element.className === 'string'
      ? `.${element.className.split(/\s+/).filter(Boolean).join('.')}`
      : '';
    return `<${tag}${id}${cls}>`;
  }

  /**
   * Get violation statistics.
   */
  getStats() {
    const byRule = { R1: 0, R2: 0, R3: 0, R4: 0 };
    const bySeverity = { error: 0, warn: 0, info: 0 };
    for (const v of this._violations) {
      byRule[v.rule] = (byRule[v.rule] || 0) + 1;
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    }
    return {
      total: this._violations.length,
      byRule,
      bySeverity,
      enabled: this.enabled,
      level: this.level
    };
  }
}
