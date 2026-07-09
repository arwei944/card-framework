(function(window) {
  'use strict';

  const EVENT_TYPES = {
    CARD_ADDED: 'cardAdded',
    CARD_UPDATED: 'cardUpdated',
    CARD_REMOVED: 'cardRemoved',
    RELATIONSHIP_ADDED: 'relationshipAdded',
    RELATIONSHIP_REMOVED: 'relationshipRemoved',
    CARD_VALIDATION_ERROR: 'cardValidationError',
    CARD_AUTO_FIXED: 'cardAutoFixed',
    LAYOUT_CHANGED: 'layoutChanged',
    FRAMEWORK_ERROR: 'frameworkError',
    DOM_SYNCHRONIZED: 'domSynchronized',
    PLUGIN_INSTALLED: 'pluginInstalled',
    PLUGIN_UNINSTALLED: 'pluginUninstalled',
    PLUGIN_ENABLED: 'pluginEnabled',
    PLUGIN_DISABLED: 'pluginDisabled',
    THEME_CHANGED: 'themeChanged',
    LANGUAGE_CHANGED: 'languageChanged',
    CIRCUIT_BREAKER_OPENED: 'circuitBreakerOpened',
    CIRCUIT_BREAKER_CLOSED: 'circuitBreakerClosed'
  };

  const DEFAULT_CONFIG = {
    DEBOUNCE_RENDER_MS: 16,
    RENDER_RAF_MS: 16,
    VALIDATION_DEBOUNCE_MS: 150,
    FULL_CHECK_INTERVAL_MS: 30000,
    VIRTUAL_SCROLL_OVERSCAN: 5,
    DEFAULT_CARD_WIDTH: 280,
    DEFAULT_CARD_HEIGHT: 200,
    CIRCUIT_BREAKER: {
      CARD_FAILURE_THRESHOLD: 5,
      GLOBAL_FAILURE_THRESHOLD: 20,
      WINDOW_MS: 60000,
      RESET_TIMEOUT_MS: 30000
    },
    ZOOM: {
      MIN: 0.25,
      MAX: 4,
      STEP: 0.1
    },
    FEEDBACK_LEVEL: 'warn',
    LAYOUT_CACHE_MAX_SIZE: 5000,
    CARD_POOL_MAX_PER_TYPE: 100
  };

  const CARD_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ARCHIVED: 'archived'
  };

  const RELATIONSHIP_TYPES = {
    REFERENCE: 'reference',
    PARENT: 'parent',
    CHILD: 'child',
    DEPENDENCY: 'dependency',
    RELATED: 'related'
  };

  const Utils = {
    generateId(prefix = 'card') {
      const timestamp = Date.now().toString(36);
      const hash = Math.random().toString(36).substr(2, 9);
      return `${prefix}_${timestamp}_${hash}`;
    },

    escapeHtml(str) {
      if (str == null) return '';
      const s = String(str);
      const div = document.createElement('div');
      div.textContent = s;
      let result = div.innerHTML;
      result = result.replace(/\//g, '&#x2F;');
      result = result.replace(/`/g, '&#x60;');
      result = result.replace(/=/g, '&#x3D;');
      return result;
    },

    escapeAttr(str) {
      if (str == null) return '';
      const s = String(str);
      return s.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\//g, '&#x2F;')
              .replace(/`/g, '&#x60;')
              .replace(/=/g, '&#x3D;')
              .replace(/\n/g, '&#10;')
              .replace(/\r/g, '&#13;')
              .replace(/\t/g, '&#9;');
    },

    sanitizeHtml(html, options) {
      return Security.sanitizeHtml(html, options);
    },

    sanitizeUrl(url) {
      return Security.sanitizeUrl(url);
    },

    sanitizeStyle(styleStr) {
      return Security.sanitizeStyle(styleStr);
    },

    isSafeUrl(url) {
      return Security.isSafeUrl(url);
    },

    debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    },

    throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN');
    },

    deepClone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime());
      if (obj instanceof Array) return obj.map(item => this.deepClone(item));
      if (typeof obj === 'object') {
        const cloned = {};
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            cloned[key] = this.deepClone(obj[key]);
          }
        }
        return cloned;
      }
      return obj;
    },

    validateType(value, type) {
      if (value === undefined || value === null || value === '') return true;
      switch (type) {
        case 'string': return typeof value === 'string';
        case 'number': return !isNaN(Number(value));
        case 'boolean': return ['true', 'false', true, false].includes(value);
        case 'array': return Array.isArray(value) || typeof value === 'string';
        case 'object': return typeof value === 'object';
        case 'date': return !isNaN(new Date(value).getTime());
        default: return true;
      }
    },

    parseValue(value, type) {
      if (value === undefined || value === null) return value;
      switch (type) {
        case 'number': return Number(value);
        case 'boolean': return value === 'true' || value === true;
        case 'array':
          if (Array.isArray(value)) return value;
          try { return JSON.parse(value); } catch { return String(value).split(',').map(s => s.trim()); }
        case 'object':
          if (typeof value === 'object') return value;
          try { return JSON.parse(value); } catch { return {}; }
        default: return String(value);
      }
    }
  };

  const Security = {
    _defaultAllowedTags: [
      'a', 'abbr', 'acronym', 'address', 'b', 'big', 'blockquote', 'br',
      'caption', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'dfn',
      'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
      'i', 'img', 'ins', 'kbd', 'li', 'ol', 'p', 'pre', 'q', 'samp',
      'small', 'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td',
      'tfoot', 'th', 'thead', 'tr', 'tt', 'u', 'ul', 'var'
    ],

    _defaultAllowedAttrs: {
      '*': ['class', 'id', 'style', 'title', 'data-*'],
      'a': ['href', 'target', 'rel', 'name'],
      'img': ['src', 'alt', 'width', 'height'],
      'table': ['width', 'border', 'cellpadding', 'cellspacing'],
      'td': ['colspan', 'rowspan', 'width', 'valign', 'align'],
      'th': ['colspan', 'rowspan', 'width', 'valign', 'align'],
      'tr': ['rowspan', 'valign', 'align'],
      'col': ['width', 'span'],
      'colgroup': ['width', 'span']
    },

    _safeProtocols: ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:', '#', '/', './', '../'],

    _dangerousStylePatterns: [
      /expression\s*\(/gi,
      /url\s*\(\s*(javascript|data)\s*:/gi,
      /behaviour\s*:/gi,
      /-moz-binding\s*:/gi,
      /vbscript\s*:/gi,
      /livescript\s*:/gi,
      /@import\s+(url\s*)?["']?(javascript|data)\s*:/gi
    ],

    sanitizeHtml(html, options = {}) {
      if (html == null) return '';
      const str = String(html);

      const allowedTags = options.allowedTags || this._defaultAllowedTags;
      const allowedAttrs = options.allowedAttrs || this._defaultAllowedAttrs;
      const allowedTagsSet = new Set(allowedTags.map(t => t.toLowerCase()));

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = str;

      const allElements = tempDiv.getElementsByTagName('*');
      const elementsToRemove = [];

      for (let i = allElements.length - 1; i >= 0; i--) {
        const el = allElements[i];
        const tagName = el.tagName.toLowerCase();

        if (!allowedTagsSet.has(tagName)) {
          elementsToRemove.push(el);
          continue;
        }

        const attrs = el.attributes;
        const attrsToRemove = [];
        const tagAllowedAttrs = allowedAttrs[tagName] || [];
        const globalAllowedAttrs = allowedAttrs['*'] || [];
        const allAllowedAttrs = [...globalAllowedAttrs, ...tagAllowedAttrs];

        for (let j = attrs.length - 1; j >= 0; j--) {
          const attr = attrs[j];
          const attrName = attr.name.toLowerCase();
          const attrValue = attr.value;

          const isAllowed = allAllowedAttrs.some(allowed => {
            if (allowed.endsWith('*')) {
              const prefix = allowed.slice(0, -1);
              return attrName.startsWith(prefix);
            }
            return attrName === allowed;
          });

          if (!isAllowed) {
            attrsToRemove.push(attrName);
            continue;
          }

          if (attrName.startsWith('on')) {
            attrsToRemove.push(attrName);
            continue;
          }

          if (attrName === 'href' || attrName === 'src' || attrName === 'action' || attrName === 'formaction') {
            if (!this.isSafeUrl(attrValue)) {
              attrsToRemove.push(attrName);
            }
          }

          if (attrName === 'style') {
            const safeStyle = this.sanitizeStyle(attrValue);
            if (safeStyle !== attrValue) {
              if (safeStyle) {
                el.setAttribute('style', safeStyle);
              } else {
                attrsToRemove.push(attrName);
              }
            }
          }
        }

        attrsToRemove.forEach(attrName => el.removeAttribute(attrName));
      }

      elementsToRemove.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
          }
          parent.removeChild(el);
        }
      });

      return tempDiv.innerHTML;
    },

    sanitizeUrl(url) {
      if (url == null) return '';
      const str = String(url).trim();

      if (str === '') return '';

      if (!this.isSafeUrl(str)) {
        return '';
      }

      return str;
    },

    isSafeUrl(url) {
      if (url == null) return false;
      const str = String(url).trim();

      if (str === '') return false;

      if (str.startsWith('#') || str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) {
        return true;
      }

      try {
        const parsed = new URL(str, window.location.origin);
        const protocol = parsed.protocol.toLowerCase();

        const safeProtocols = ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:'];
        if (!safeProtocols.includes(protocol)) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    },

    sanitizeStyle(styleStr) {
      if (styleStr == null) return '';
      let str = String(styleStr);

      for (const pattern of this._dangerousStylePatterns) {
        if (pattern.test(str)) {
          str = str.replace(pattern, '');
        }
      }

      str = str.replace(/@import[^;]*;?/gi, (match) => {
        if (/url\s*\(\s*(javascript|data)\s*:/i.test(match)) {
          return '';
        }
        return match;
      });

      return str.trim();
    },

    sanitizeStyleObject(styleObj) {
      if (!styleObj || typeof styleObj !== 'object') return { sanitized: styleObj, changed: false, removedProps: [] };

      const sanitized = {};
      const removedProps = [];
      let changed = false;

      for (const [key, value] of Object.entries(styleObj)) {
        const strValue = String(value);
        const safeValue = this.sanitizeStyle(strValue);
        if (safeValue !== strValue) {
          changed = true;
          if (safeValue) {
            sanitized[key] = safeValue;
          } else {
            removedProps.push(key);
          }
        } else {
          sanitized[key] = value;
        }
      }

      return { sanitized, changed, removedProps };
    },

    escapeAttr(str) {
      if (str == null) return '';
      const s = String(str);
      return s.replace(/&/g, '&amp;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\//g, '&#x2F;')
              .replace(/`/g, '&#x60;')
              .replace(/=/g, '&#x3D;')
              .replace(/\n/g, '&#10;')
              .replace(/\r/g, '&#13;')
              .replace(/\t/g, '&#9;');
    },

    checkCSPCompatibility() {
      const issues = [];

      const hasEval = (function() {
        try {
          const test = new Function('return 1');
          return false;
        } catch (e) {
          return true;
        }
      })();

      if (hasEval) {
        issues.push({
          type: 'csp-eval',
          severity: 'high',
          message: 'CSP 禁止使用 eval() 和 new Function()'
        });
      }

      const testInlineStyle = (function() {
        try {
          const testEl = document.createElement('div');
          testEl.setAttribute('style', 'color: red');
          return testEl.style.color === 'red';
        } catch (e) {
          return false;
        }
      })();

      if (!testInlineStyle) {
        issues.push({
          type: 'csp-inline-style',
          severity: 'medium',
          message: 'CSP 禁止内联样式，部分功能可能受影响'
        });
      }

      return {
        compatible: issues.length === 0,
        issues,
        recommendations: [
          '使用 nonce 或 hash 来允许必要的内联样式',
          '避免使用 javascript: 协议的 URL',
          '确保所有外部资源来源可信'
        ]
      };
    },

    validatePropValue(value, propSchema) {
      if (value === undefined || value === null || value === '') {
        return { valid: true, value };
      }

      const type = propSchema.type;
      const isSafe = propSchema.safe === true;

      let sanitizedValue = value;
      let wasSanitized = false;
      let warning = null;

      if (type === 'url' || (isSafe && type === 'string')) {
        const beforeUrl = sanitizedValue;
        sanitizedValue = this.sanitizeUrl(value);
        if (value !== '' && sanitizedValue === '') {
          wasSanitized = true;
          warning = 'URL 包含不安全的协议，已被清理';
        } else if (sanitizedValue !== beforeUrl) {
          wasSanitized = true;
        }
      }

      if (type === 'html') {
        const beforeHtml = sanitizedValue;
        sanitizedValue = this.sanitizeHtml(value);
        if (sanitizedValue !== beforeHtml) {
          wasSanitized = true;
          warning = 'HTML 内容已安全清理';
        }
      }

      if (propSchema.safe && typeof sanitizedValue === 'string') {
        if (type === 'string' && !propSchema.allowHtml) {
          const beforeEscape = sanitizedValue;
          sanitizedValue = Utils.escapeHtml(sanitizedValue);
          if (sanitizedValue !== beforeEscape) {
            wasSanitized = true;
          }
        }
      }

      const sanitized = wasSanitized;
      const result = { valid: true, value: sanitizedValue, sanitized };
      if (warning) {
        result.warning = warning;
      }
      return result;
    },

    checkTemplateSecurity(template) {
      const issues = [];
      if (!template || typeof template !== 'string') return { safe: true, issues };

      const lowerTemplate = template.toLowerCase();

      const inlineEventPattern = /\bon[a-z]+\s*=/gi;
      const inlineEventMatches = lowerTemplate.match(inlineEventPattern);
      if (inlineEventMatches) {
        const uniqueEvents = [...new Set(inlineEventMatches.map(m => m.trim().replace(/=$/, '')))];
        issues.push({
          type: 'inline-events',
          severity: 'high',
          message: `检测到内联事件处理器: ${uniqueEvents.join(', ')}`,
          details: uniqueEvents
        });
      }

      const javascriptUrlPattern = /(href|src|action|formaction|on\w+)\s*=\s*["']?\s*javascript\s*:/gi;
      if (javascriptUrlPattern.test(lowerTemplate)) {
        issues.push({
          type: 'javascript-url',
          severity: 'high',
          message: '检测到 javascript: 协议 URL'
        });
      }

      const vbscriptUrlPattern = /(href|src|action|formaction)\s*=\s*["']?\s*vbscript\s*:/gi;
      if (vbscriptUrlPattern.test(lowerTemplate)) {
        issues.push({
          type: 'vbscript-url',
          severity: 'high',
          message: '检测到 vbscript: 协议 URL'
        });
      }

      const expressionPattern = /expression\s*\(/gi;
      if (expressionPattern.test(lowerTemplate)) {
        issues.push({
          type: 'css-expression',
          severity: 'high',
          message: '检测到 CSS expression()'
        });
      }

      const scriptTagPattern = /<script[\s>]/gi;
      if (scriptTagPattern.test(lowerTemplate)) {
        issues.push({
          type: 'script-tag',
          severity: 'high',
          message: '检测到 <script> 标签'
        });
      }

      const iframePattern = /<iframe[\s>]/gi;
      if (iframePattern.test(lowerTemplate)) {
        issues.push({
          type: 'iframe',
          severity: 'medium',
          message: '检测到 <iframe> 标签'
        });
      }

      const dataUrlPattern = /url\s*\(\s*data\s*:/gi;
      if (dataUrlPattern.test(lowerTemplate)) {
        issues.push({
          type: 'data-url',
          severity: 'medium',
          message: '检测到 data: URL 协议'
        });
      }

      return {
        safe: issues.length === 0,
        issues
      };
    }
  };

  const Perf = {
    _marks: new Map(),
    _measures: [],
    _stats: {
      renderCount: 0,
      totalRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      minRenderTime: Infinity,
      cardCount: 0,
      lastRenderTime: 0
    },

    mark(name) {
      this._marks.set(name, performance.now());
    },

    measure(name, startMark, endMark) {
      const start = this._marks.get(startMark);
      const end = this._marks.get(endMark);
      if (start === undefined || end === undefined) return null;
      const duration = end - start;
      this._measures.push({ name, duration, timestamp: Date.now() });
      if (this._measures.length > 100) {
        this._measures.shift();
      }
      return duration;
    },

    recordRender(duration, cardCount) {
      this._stats.renderCount++;
      this._stats.totalRenderTime += duration;
      this._stats.avgRenderTime = this._stats.totalRenderTime / this._stats.renderCount;
      this._stats.maxRenderTime = Math.max(this._stats.maxRenderTime, duration);
      this._stats.minRenderTime = Math.min(this._stats.minRenderTime, duration);
      this._stats.cardCount = cardCount;
      this._stats.lastRenderTime = duration;
    },

    getStats() {
      return {
        ...this._stats,
        minRenderTime: this._stats.minRenderTime === Infinity ? 0 : this._stats.minRenderTime,
        recentMeasures: this._measures.slice(-20)
      };
    },

    reset() {
      this._marks.clear();
      this._measures = [];
      this._stats = {
        renderCount: 0,
        totalRenderTime: 0,
        avgRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: Infinity,
        cardCount: 0,
        lastRenderTime: 0
      };
    }
  };

  const FeedbackSystem = {
    config: {
      level: 'info',
      showEmoji: true
    },

    setLevel(level) {
      this.config.level = level;
    },

    info(message, suggestion = '', example = '') {
      if (this.config.level === 'silent') return;
      const prefix = this.config.showEmoji ? 'ℹ️ ' : '';
      console.info(`[CardFrame] ${prefix}${message}`);
      if (suggestion) console.info(`[CardFrame] 💡 ${suggestion}`);
      if (example) console.info(`[CardFrame] 📝 示例：${example}`);
    },

    warn(message, fix = '', correctExample = '') {
      if (this.config.level === 'silent' || this.config.level === 'error') return;
      const prefix = this.config.showEmoji ? '⚠️ ' : '';
      console.warn(`[CardFrame] ${prefix}${message}`);
      if (fix) console.warn(`[CardFrame] 🔧 修复方式：${fix}`);
      if (correctExample) console.warn(`[CardFrame] ✅ 正确写法：${correctExample}`);
    },

    error(message, recover = '', docLink = '') {
      if (this.config.level === 'silent') return;
      const prefix = this.config.showEmoji ? '❌ ' : '';
      console.error(`[CardFrame] ${prefix}${message}`);
      if (recover) console.error(`[CardFrame] 🏥 恢复方式：${recover}`);
      if (docLink) console.error(`[CardFrame] 📚 文档：${docLink}`);
    },

    fix(message, changes = '') {
      if (this.config.level === 'silent') return;
      const prefix = this.config.showEmoji ? '🔧 ' : '';
      console.info(`[CardFrame] ${prefix}${message}`);
      if (changes) console.info(`[CardFrame] 📋 变更：${changes}`);
    }
  };

  class EventBus {
    constructor() {
      this.events = new Map();
    }

    on(eventName, listener) {
      if (!this.events.has(eventName)) {
        this.events.set(eventName, new Set());
      }
      this.events.get(eventName).add(listener);
    }

    off(eventName, listener) {
      const listeners = this.events.get(eventName);
      if (listeners) {
        listeners.delete(listener);
      }
    }

    once(eventName, listener) {
      const onceListener = (event) => {
        this.off(eventName, onceListener);
        listener(event);
      };
      this.on(eventName, onceListener);
    }

    emit(eventName, detail) {
      const listeners = this.events.get(eventName);
      if (listeners) {
        listeners.forEach(listener => {
          try {
            listener({ type: eventName, detail });
          } catch (e) {
            console.error('[CardFrame] 事件监听器错误:', e);
            if (eventName !== EVENT_TYPES.FRAMEWORK_ERROR) {
              eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
                type: 'listener_error',
                message: e.message,
                error: e,
                context: { eventName, detail },
                timestamp: Date.now()
              });
            }
          }
        });
      }
    }
  }

  /**
   * ActionLogger - 操作日志记录与时光机（undo/redo）
   * 记录所有 Store 变更操作，支持撤销/重做/历史回滚
   */
  class ActionLogger {
    constructor(options = {}) {
      this.maxHistory = options.maxHistory || 100;
      this.enabled = options.enabled !== false;
      this._history = [];        // 操作历史栈
      this._redoStack = [];      // 重做栈
      this._listeners = new Set();
    }

    /**
     * 记录一个操作
     * @param {string} type - 操作类型 (add/update/remove)
     * @param {object} payload - 操作数据（前状态、后状态等）
     */
    record(type, payload) {
      if (!this.enabled) return;

      const action = {
        type,
        timestamp: Date.now(),
        ...payload
      };

      this._history.push(action);

      // 限制历史大小
      if (this._history.length > this.maxHistory) {
        this._history.shift();
      }

      // 新操作清空 redo 栈
      this._redoStack = [];

      this._notifyChange();
      return action;
    }

    /**
     * 撤销最近一次操作
     * @param {Store} store - 框架 Store 实例
     * @returns {boolean} 是否成功
     */
    undo(store) {
      if (this._history.length === 0) return false;

      const action = this._history.pop();
      this._performUndo(action, store);
      this._redoStack.push(action);

      this._notifyChange();
      return true;
    }

    /**
     * 重做最近一次撤销的操作
     * @param {Store} store - 框架 Store 实例
     * @returns {boolean} 是否成功
     */
    redo(store) {
      if (this._redoStack.length === 0) return false;

      const action = this._redoStack.pop();
      this._performRedo(action, store);
      this._history.push(action);

      this._notifyChange();
      return true;
    }

    /**
     * 回滚到指定时间点
     * @param {number} timestamp - 时间戳
     * @param {Store} store - 框架 Store 实例
     * @returns {boolean} 是否成功
     */
    rollback(timestamp, store) {
      // 找到该时间点之后的所有操作
      const toUndo = this._history.filter(a => a.timestamp > timestamp);
      if (toUndo.length === 0) return false;

      // 倒序撤销
      toUndo.reverse().forEach(action => {
        this._performUndo(action, store);
        this._redoStack.push(action);
      });

      this._notifyChange();
      return true;
    }

    /**
     * 获取历史记录
     */
    getHistory() {
      return this._history.slice();
    }

    /**
     * 清空所有历史
     */
    clear() {
      this._history = [];
      this._redoStack = [];
      this._notifyChange();
    }

    /**
     * 暂停记录
     */
    pause() {
      this.enabled = false;
    }

    /**
     * 恢复记录
     */
    resume() {
      this.enabled = true;
    }

    /**
     * 是否可以撤销
     */
    canUndo() {
      return this._history.length > 0;
    }

    /**
     * 是否可以重做
     */
    canRedo() {
      return this._redoStack.length > 0;
    }

    /**
     * 订阅历史变化
     */
    subscribe(listener) {
      this._listeners.add(listener);
      return () => this._listeners.delete(listener);
    }

    /**
     * 获取状态
     */
    getStatus() {
      return {
        historyCount: this._history.length,
        redoCount: this._redoStack.length,
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        enabled: this.enabled
      };
    }

    // 私有方法
    _performUndo(action, store) {
      if (!store) return;

      try {
        switch (action.type) {
          case 'addCard':
            // 撤销添加 = 删除卡片
            if (action.card) {
              store.removeCard(action.card.id);
            }
            break;
          case 'updateCard':
            // 撤销更新 = 恢复之前的状态
            if (action.cardId && action.previousState) {
              store.updateCard(action.cardId, action.previousState);
            }
            break;
          case 'removeCard':
            // 撤销删除 = 重新添加
            if (action.card) {
              store.addCard(action.card);
            }
            break;
          case 'addRelationship':
            if (action.relationship) {
              store.removeRelationship(action.relationship.id);
            }
            break;
          case 'removeRelationship':
            if (action.relationship) {
              store.addRelationship(action.relationship);
            }
            break;
        }
      } catch (e) {
        eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'undo_error',
          message: '撤销操作失败: ' + e.message,
          error: e,
          context: { action },
          timestamp: Date.now()
        });
      }
    }

    _performRedo(action, store) {
      if (!store) return;

      try {
        switch (action.type) {
          case 'addCard':
            if (action.card) {
              store.addCard(action.card);
            }
            break;
          case 'updateCard':
            if (action.cardId && action.newState) {
              store.updateCard(action.cardId, action.newState);
            }
            break;
          case 'removeCard':
            if (action.card) {
              store.removeCard(action.card.id);
            }
            break;
          case 'addRelationship':
            if (action.relationship) {
              store.addRelationship(action.relationship);
            }
            break;
          case 'removeRelationship':
            if (action.relationship) {
              store.removeRelationship(action.relationship.id);
            }
            break;
        }
      } catch (e) {
        eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
          type: 'redo_error',
          message: '重做操作失败: ' + e.message,
          error: e,
          context: { action },
          timestamp: Date.now()
        });
      }
    }

    _notifyChange() {
      const status = this.getStatus();
      this._listeners.forEach(l => {
        try { l(status); } catch (e) { /* 静默 */ }
      });
    }
  }

  const eventBus = new EventBus();

  class CircuitBreaker {
    constructor(options = {}) {
      this.cardFailureThreshold = options.cardFailureThreshold || DEFAULT_CONFIG.CIRCUIT_BREAKER.CARD_FAILURE_THRESHOLD;
      this.globalFailureThreshold = options.globalFailureThreshold || DEFAULT_CONFIG.CIRCUIT_BREAKER.GLOBAL_FAILURE_THRESHOLD;
      this.windowMs = options.windowMs || DEFAULT_CONFIG.CIRCUIT_BREAKER.WINDOW_MS;
      this.resetTimeoutMs = options.resetTimeoutMs || DEFAULT_CONFIG.CIRCUIT_BREAKER.RESET_TIMEOUT_MS;
      
      this._cardFailures = new Map();
      this._globalFailures = [];
      this._cardStates = new Map();
      this._globalState = 'closed';
      this._lastGlobalOpen = 0;
      this._safeMode = false;
    }

    recordSuccess(cardId = null) {
      if (cardId) {
        const state = this._cardStates.get(cardId);
        if (state === 'open') {
          this._cardStates.set(cardId, 'closed');
          eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { cardId, level: 'card' });
        }
        this._cardFailures.delete(cardId);
      }
      
      if (this._globalState === 'open' && Date.now() - this._lastGlobalOpen > this.resetTimeoutMs) {
        this._globalState = 'half-open';
      }
    }

    recordFailure(cardId = null) {
      const now = Date.now();
      
      if (cardId) {
        let failures = this._cardFailures.get(cardId) || [];
        failures = failures.filter(t => now - t < this.windowMs);
        failures.push(now);
        this._cardFailures.set(cardId, failures);

        if (failures.length >= this.cardFailureThreshold) {
          const state = this._cardStates.get(cardId);
          if (state !== 'open') {
            this._cardStates.set(cardId, 'open');
            eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_OPENED, { cardId, level: 'card', failureCount: failures.length });
            FeedbackSystem.warn(
              `卡片 ${cardId} 触发熔断`,
              `错误次数: ${failures.length}，将在 ${this.resetTimeoutMs / 1000} 秒后尝试恢复`
            );
          }
        }
      }

      this._globalFailures = this._globalFailures.filter(t => now - t < this.windowMs);
      this._globalFailures.push(now);

      if (this._globalFailures.length >= this.globalFailureThreshold) {
        if (this._globalState !== 'open') {
          this._globalState = 'open';
          this._lastGlobalOpen = now;
          this._safeMode = true;
          eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_OPENED, { 
            level: 'global', 
            failureCount: this._globalFailures.length,
            safeMode: true 
          });
          FeedbackSystem.error(
            '全局熔断已触发，进入安全模式',
            `错误次数: ${this._globalFailures.length}，非核心功能将被禁用`,
            '减少操作频率，等待系统自动恢复'
          );
        }
      }
    }

    canExecute(cardId = null) {
      if (this._safeMode) {
        if (Date.now() - this._lastGlobalOpen > this.resetTimeoutMs) {
          this._globalState = 'half-open';
          this._safeMode = false;
          eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { level: 'global', recovering: true });
          return true;
        }
        return false;
      }

      if (cardId) {
        const state = this._cardStates.get(cardId);
        if (state === 'open') {
          const failures = this._cardFailures.get(cardId) || [];
          if (failures.length > 0 && Date.now() - failures[failures.length - 1] > this.resetTimeoutMs) {
            this._cardStates.set(cardId, 'half-open');
            return true;
          }
          return false;
        }
      }

      return true;
    }

    execute(fn, cardId = null) {
      if (!this.canExecute(cardId)) {
        throw new Error(cardId ? `卡片 ${cardId} 已熔断` : '全局熔断已触发');
      }

      try {
        const result = fn();
        this.recordSuccess(cardId);
        return result;
      } catch (e) {
        this.recordFailure(cardId);
        throw e;
      }
    }

    getCardState(cardId) {
      return this._cardStates.get(cardId) || 'closed';
    }

    getGlobalState() {
      return this._globalState;
    }

    isSafeMode() {
      return this._safeMode;
    }

    reset(cardId = null) {
      if (cardId) {
        this._cardFailures.delete(cardId);
        this._cardStates.delete(cardId);
        eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { cardId, level: 'card', manual: true });
      } else {
        this._globalFailures = [];
        this._globalState = 'closed';
        this._safeMode = false;
        eventBus.emit(EVENT_TYPES.CIRCUIT_BREAKER_CLOSED, { level: 'global', manual: true });
      }
    }

    getStats() {
      return {
        globalState: this._globalState,
        safeMode: this._safeMode,
        globalFailureCount: this._globalFailures.length,
        cardCount: this._cardStates.size,
        openCards: Array.from(this._cardStates.entries())
          .filter(([_, state]) => state === 'open')
          .map(([id]) => id)
      };
    }
  }

  class ThemeManager {
    constructor(container = null) {
      this.container = container;
      this.currentTheme = 'light';
      this.themes = new Map();
      this._systemThemeListener = null;
      this._followSystem = false;

      this._registerDefaultThemes();
    }

    setContainer(container) {
      this.container = container;
      this.applyTheme(this.currentTheme);
    }

    _registerDefaultThemes() {
      this.registerTheme({
        name: 'light',
        label: '亮色主题',
        variables: {
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f5f5f5',
          '--bg-tertiary': '#e8e8e8',
          '--text-primary': '#1a1a1a',
          '--text-secondary': '#666666',
          '--text-tertiary': '#999999',
          '--border-color': '#e0e0e0',
          '--accent-color': '#3b82f6',
          '--accent-hover': '#2563eb',
          '--success-color': '#22c55e',
          '--warning-color': '#f59e0b',
          '--error-color': '#ef4444',
          '--card-shadow': '0 2px 8px rgba(0,0,0,0.1)',
          '--card-hover-shadow': '0 4px 16px rgba(0,0,0,0.15)'
        }
      });

      this.registerTheme({
        name: 'dark',
        label: '暗色主题',
        variables: {
          '--bg-primary': '#1a1a1a',
          '--bg-secondary': '#2a2a2a',
          '--bg-tertiary': '#3a3a3a',
          '--text-primary': '#ffffff',
          '--text-secondary': '#a0a0a0',
          '--text-tertiary': '#707070',
          '--border-color': '#404040',
          '--accent-color': '#60a5fa',
          '--accent-hover': '#3b82f6',
          '--success-color': '#4ade80',
          '--warning-color': '#fbbf24',
          '--error-color': '#f87171',
          '--card-shadow': '0 2px 8px rgba(0,0,0,0.3)',
          '--card-hover-shadow': '0 4px 16px rgba(0,0,0,0.4)'
        }
      });
    }

    registerTheme(themeDef) {
      if (!themeDef || !themeDef.name) {
        throw new Error('主题必须定义 name 属性');
      }

      this.themes.set(themeDef.name, {
        name: themeDef.name,
        label: themeDef.label || themeDef.name,
        description: themeDef.description || '',
        variables: themeDef.variables || {},
        extends: themeDef.extends || null
      });

      return true;
    }

    getTheme(name) {
      return this.themes.get(name) || null;
    }

    getAllThemes() {
      return Array.from(this.themes.values()).map(t => ({
        name: t.name,
        label: t.label,
        description: t.description
      }));
    }

    applyTheme(themeName) {
      const theme = this.themes.get(themeName);
      if (!theme) {
        FeedbackSystem.warn(`主题 "${themeName}" 不存在`);
        return false;
      }

      this.currentTheme = themeName;

      if (this.container) {
        let variables = { ...theme.variables };
        
        if (theme.extends) {
          const parentTheme = this.themes.get(theme.extends);
          if (parentTheme) {
            variables = { ...parentTheme.variables, ...variables };
          }
        }

        for (const [key, value] of Object.entries(variables)) {
          this.container.style.setProperty(key, value);
        }

        this.container.dataset.theme = themeName;
      }

      eventBus.emit(EVENT_TYPES.THEME_CHANGED, { themeName });
      return true;
    }

    getCurrentTheme() {
      return this.currentTheme;
    }

    followSystemTheme(enable = true) {
      this._followSystem = enable;

      if (enable) {
        if (window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          
          this._systemThemeListener = (e) => {
            if (this._followSystem) {
              this.applyTheme(e.matches ? 'dark' : 'light');
            }
          };

          if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', this._systemThemeListener);
          } else if (mediaQuery.addListener) {
            mediaQuery.addListener(this._systemThemeListener);
          }

          this.applyTheme(mediaQuery.matches ? 'dark' : 'light');
        }
      } else {
        if (this._systemThemeListener && window.matchMedia) {
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', this._systemThemeListener);
          } else if (mediaQuery.removeListener) {
            mediaQuery.removeListener(this._systemThemeListener);
          }
        }
        this._systemThemeListener = null;
      }
    }

    isFollowingSystem() {
      return this._followSystem;
    }

    toggleTheme() {
      const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
      this.applyTheme(nextTheme);
      return nextTheme;
    }

    setAnimationDuration(duration) {
      if (typeof duration !== 'number' || duration < 0) {
        throw new Error('动画时长必须是非负数字');
      }
      this._animationDuration = duration;
      if (this.container) {
        this.container.style.setProperty('--transition-duration', duration + 's');
      }
    }

    getAnimationDuration() {
      return this._animationDuration !== undefined ? this._animationDuration : 0.3;
    }
  }

  /**
   * PerfPanel - 性能监控面板
   * 实时监控 FPS、内存、渲染时间等指标
   */
  class PerfPanel {
    constructor() {
      this._enabled = false;
      this._container = null;
      this._rafId = null;
      this._frameCount = 0;
      this._lastTime = 0;
      this._fps = 60;
      this._domStats = { cards: 0, relationships: 0 };
    }

    enable(container) {
      this._enabled = true;
      this._container = container;
      if (container) {
        this._createPanel();
        this._startMonitoring();
      }
    }

    disable() {
      this._enabled = false;
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this._container) {
        const panel = this._container.querySelector('.cf-perf-panel');
        if (panel) panel.remove();
      }
    }

    _createPanel() {
      const panel = document.createElement('div');
      panel.className = 'cf-perf-panel';
      panel.innerHTML = `
        <div class="cf-perf-header">📊 性能监控</div>
        <div class="cf-perf-metrics">
          <div><span class="cf-perf-label">FPS:</span> <span class="cf-perf-fps">--</span></div>
          <div><span class="cf-perf-label">渲染:</span> <span class="cf-perf-render">--</span>ms</div>
          <div><span class="cf-perf-label">卡片:</span> <span class="cf-perf-cards">--</span></div>
          <div><span class="cf-perf-label">关系:</span> <span class="cf-perf-rels">--</span></div>
          <div><span class="cf-perf-label">内存:</span> <span class="cf-perf-mem">--</span></div>
        </div>
      `;
      const style = document.createElement('style');
      style.textContent = `
        .cf-perf-panel { position: fixed; bottom: 10px; right: 10px; background: rgba(0,0,0,0.85); color: #fff; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; z-index: 10000; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .cf-perf-header { font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #444; padding-bottom: 4px; }
        .cf-perf-metrics > div { margin: 4px 0; display: flex; justify-content: space-between; }
        .cf-perf-label { color: #aaa; }
        .cf-perf-fps { color: #4ade80; }
        .cf-perf-fps.low { color: #ef4444; }
        .cf-perf-fps.medium { color: #f59e0b; }
      `;
      document.head.appendChild(style);
      this._container.appendChild(panel);
      this._panelEl = panel;
    }

    _startMonitoring() {
      const loop = (time) => {
        if (!this._enabled) return;
        this._frameCount++;
        if (time - this._lastTime >= 1000) {
          this._fps = Math.round(this._frameCount * 1000 / (time - this._lastTime));
          this._frameCount = 0;
          this._lastTime = time;
          this._updateDisplay();
        }
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
    }

    _updateDisplay() {
      if (!this._panelEl) return;
      const fpsEl = this._panelEl.querySelector('.cf-perf-fps');
      if (fpsEl) {
        fpsEl.textContent = this._fps;
        fpsEl.className = 'cf-perf-fps' + (this._fps < 30 ? ' low' : this._fps < 50 ? ' medium' : '');
      }
      // 渲染时间
      const perfStats = Perf.getStats();
      const renderEl = this._panelEl.querySelector('.cf-perf-render');
      if (renderEl) renderEl.textContent = perfStats.avgTime.toFixed(1);
      // 内存（如果可用）
      const memEl = this._panelEl.querySelector('.cf-perf-mem');
      if (memEl && performance && performance.memory) {
        memEl.textContent = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1) + ' MB';
      }
    }

    updateDOMStats(cards, relationships) {
      this._domStats = { cards, relationships };
      if (this._panelEl) {
        const cardsEl = this._panelEl.querySelector('.cf-perf-cards');
        const relsEl = this._panelEl.querySelector('.cf-perf-rels');
        if (cardsEl) cardsEl.textContent = cards;
        if (relsEl) relsEl.textContent = relationships;
      }
    }

    isEnabled() {
      return this._enabled;
    }
  }

  /**
   * GlobalErrorHandler - 全局错误捕获与聚合
   */
  class GlobalErrorHandler {
    constructor(eventBus) {
      this._eventBus = eventBus;
      this._errorCounts = new Map();
      this._handlers = [];
      this._enabled = false;
    }

    enable() {
      if (this._enabled) return;
      this._enabled = true;

      // window.onerror
      this._onError = (message, source, lineno, colno, error) => {
        this._handleError('window_error', { message, source, lineno, colno, error });
        return false;
      };
      window.addEventListener('error', this._onError);

      // unhandledrejection
      this._onRejection = (event) => {
        this._handleError('unhandledrejection', {
          message: event.reason?.message || String(event.reason),
          reason: event.reason
        });
      };
      window.addEventListener('unhandledrejection', this._onRejection);
    }

    disable() {
      if (!this._enabled) return;
      this._enabled = false;
      if (this._onError) window.removeEventListener('error', this._onError);
      if (this._onRejection) window.removeEventListener('unhandledrejection', this._onRejection);
    }

    _handleError(type, data) {
      const key = `${type}:${data.message}`;
      const count = (this._errorCounts.get(key) || 0) + 1;
      this._errorCounts.set(key, count);

      this._eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
        type: `global_${type}`,
        message: data.message,
        error: data.error || data.reason,
        context: { source: data.source, lineno: data.lineno, colno: data.colno, count },
        timestamp: Date.now()
      });
    }

    getErrorStats() {
      return Array.from(this._errorCounts.entries()).map(([key, count]) => ({
        key,
        count,
        type: key.split(':')[0]
      })).sort((a, b) => b.count - a.count);
    }

    clear() {
      this._errorCounts.clear();
    }

    isEnabled() {
      return this._enabled;
    }
  }

  // ====================== Phase D.2: 性能优化进阶 ======================

  /**
   * CardObjectPool - 卡片对象池
   * 复用卡片对象，减少 GC 压力，提升频繁创建/删除场景性能
   */
  class CardObjectPool {
    constructor(options = {}) {
      this._pool = new Map();       // type -> array of pooled cards
      this._maxPerType = options.maxPerType || 100;
      this._hits = 0;
      this._misses = 0;
      this._releases = 0;
    }

    /**
     * 从池中获取一个指定类型的卡片对象
     * @param {string} type 卡片类型
     * @returns {Object|null} 池中卡片或 null
     */
    acquire(type) {
      const list = this._pool.get(type);
      if (list && list.length > 0) {
        const card = list.pop();
        this._hits++;
        // 清理引用，准备复用
        card._inPool = false;
        return card;
      }
      this._misses++;
      return null;
    }

    /**
     * 归还一个卡片对象到池中
     * @param {Object} card 卡片对象
     */
    release(card) {
      if (!card || !card.type) return;
      if (card._inPool) return;
      card._inPool = true;

      let list = this._pool.get(card.type);
      if (!list) {
        list = [];
        this._pool.set(card.type, list);
      }
      if (list.length >= this._maxPerType) {
        // 池已满，丢弃
        return;
      }
      // 重置卡片以便复用
      card.id = null;
      card.props = {};
      card._relations = [];
      list.push(card);
      this._releases++;
    }

    /**
     * 清空对象池
     */
    clear() {
      this._pool.clear();
    }

    /**
     * 获取池统计信息
     */
    getStats() {
      const byType = {};
      let total = 0;
      this._pool.forEach((list, type) => {
        byType[type] = list.length;
        total += list.length;
      });
      return {
        total,
        byType,
        hits: this._hits,
        misses: this._misses,
        releases: this._releases,
        hitRate: this._hits + this._misses > 0
          ? this._hits / (this._hits + this._misses)
          : 0
      };
    }

    /**
     * 调整每种类型的最大池大小
     */
    setMaxPerType(max) {
      this._maxPerType = max;
    }
  }

  /**
   * LayoutCache - 布局缓存与增量计算
   * 缓存已计算好的布局结果，仅对变更卡片重新计算
   */
  class LayoutCache {
    constructor(options = {}) {
      this._cache = new Map();      // cardId -> layoutResult
      this._dirty = new Set();      // 脏卡片 ID
      this._maxSize = options.maxSize || 5000;
      this._hits = 0;
      this._misses = 0;
    }

    /**
     * 标记卡片为脏（需要重算）
     */
    markDirty(cardId) {
      if (cardId) this._dirty.add(cardId);
    }

    /**
     * 批量标记脏卡片
     */
    markDirtyBatch(cardIds) {
      if (Array.isArray(cardIds)) {
        cardIds.forEach(id => this._dirty.add(id));
      }
    }

    /**
     * 标记整张卡片为脏
     */
    markAllDirty() {
      // 不枚举 _cache 以避免影响 Map 迭代
      const ids = Array.from(this._cache.keys());
      ids.forEach(id => this._dirty.add(id));
    }

    /**
     * 获取缓存的布局结果
     */
    get(cardId) {
      const value = this._cache.get(cardId);
      if (value !== undefined) {
        this._hits++;
        return value;
      }
      this._misses++;
      return null;
    }

    /**
     * 设置缓存
     */
    set(cardId, layoutResult) {
      if (this._cache.size >= this._maxSize && !this._cache.has(cardId)) {
        // 简单 LRU：删除最早插入的
        const firstKey = this._cache.keys().next().value;
        this._cache.delete(firstKey);
      }
      this._cache.set(cardId, layoutResult);
      this._dirty.delete(cardId);
    }

    /**
     * 移除单张卡片缓存
     */
    remove(cardId) {
      this._cache.delete(cardId);
      this._dirty.delete(cardId);
    }

    /**
     * 批量移除
     */
    removeBatch(cardIds) {
      if (Array.isArray(cardIds)) {
        cardIds.forEach(id => {
          this._cache.delete(id);
          this._dirty.delete(id);
        });
      }
    }

    /**
     * 清空所有缓存
     */
    clear() {
      this._cache.clear();
      this._dirty.clear();
    }

    /**
     * 获取所有脏卡片 ID
     */
    getDirtyCards() {
      return Array.from(this._dirty);
    }

    /**
     * 是否脏
     */
    isDirty(cardId) {
      return this._dirty.has(cardId);
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        size: this._cache.size,
        dirty: this._dirty.size,
        hits: this._hits,
        misses: this._misses,
        hitRate: this._hits + this._misses > 0
          ? this._hits / (this._hits + this._misses)
          : 0
      };
    }
  }

  /**
   * QueryIndex - 大数据量查询索引
   * 为 Store 中的卡片按类型/标签/状态建立索引，加速查询
   */
  class QueryIndex {
    constructor() {
      this._byType = new Map();      // type -> Set<id>
      this._byTag = new Map();       // tag -> Set<id>
      this._byStatus = new Map();    // status -> Set<id>
      this._byId = new Map();        // id -> { type, tags:Set, status }
    }

    /**
     * 给一张卡片建立索引
     */
    add(card) {
      if (!card || !card.id) return;
      this._removeFromSets(card.id, this._byId.get(card.id));
      const meta = {
        type: card.type,
        tags: new Set(Array.isArray(card.props?.tags) ? card.props.tags : []),
        status: card.status || 'active'
      };
      this._byId.set(card.id, meta);

      this._addToSet(this._byType, meta.type, card.id);
      meta.tags.forEach(tag => this._addToSet(this._byTag, tag, card.id));
      this._addToSet(this._byStatus, meta.status, card.id);
    }

    _addToSet(map, key, id) {
      if (!key) return;
      let set = map.get(key);
      if (!set) {
        set = new Set();
        map.set(key, set);
      }
      set.add(id);
    }

    _removeFromSets(id, meta) {
      if (!meta) return;
      this._removeFromSet(this._byType, meta.type, id);
      if (meta.tags) {
        meta.tags.forEach(tag => this._removeFromSet(this._byTag, tag, id));
      }
      this._removeFromSet(this._byStatus, meta.status, id);
    }

    _removeFromSet(map, key, id) {
      if (!key) return;
      const set = map.get(key);
      if (!set) return;
      set.delete(id);
      if (set.size === 0) map.delete(key);
    }

    /**
     * 从索引中移除一张卡片
     */
    remove(cardId) {
      if (!cardId) return;
      const meta = this._byId.get(cardId);
      if (!meta) return;
      this._removeFromSets(cardId, meta);
      this._byId.delete(cardId);
    }

    /**
     * 按类型查询 ID
     */
    queryByType(type) {
      const set = this._byType.get(type);
      return set ? Array.from(set) : [];
    }

    /**
     * 按标签查询 ID
     */
    queryByTag(tag) {
      const set = this._byTag.get(tag);
      return set ? Array.from(set) : [];
    }

    /**
     * 按状态查询 ID
     */
    queryByStatus(status) {
      const set = this._byStatus.get(status);
      return set ? Array.from(set) : [];
    }

    /**
     * 多条件交集查询
     */
    query(criteria = {}) {
      let result = null;
      if (criteria.type) {
        result = new Set(this.queryByType(criteria.type));
      }
      if (criteria.tag) {
        const tagSet = new Set(this.queryByTag(criteria.tag));
        result = result ? this._intersect(result, tagSet) : tagSet;
      }
      if (criteria.status) {
        const statusSet = new Set(this.queryByStatus(criteria.status));
        result = result ? this._intersect(result, statusSet) : statusSet;
      }
      return result ? Array.from(result) : [];
    }

    _intersect(setA, setB) {
      const [small, large] = setA.size < setB.size ? [setA, setB] : [setB, setA];
      const result = new Set();
      small.forEach(id => {
        if (large.has(id)) result.add(id);
      });
      return result;
    }

    /**
     * 清空索引
     */
    clear() {
      this._byType.clear();
      this._byTag.clear();
      this._byStatus.clear();
      this._byId.clear();
    }

    /**
     * 索引统计
     */
    getStats() {
      return {
        total: this._byId.size,
        byType: this._byType.size,
        byTag: this._byTag.size,
        byStatus: this._byStatus.size
      };
    }
  }

  // ====================== Phase D.3: Web Components 增强版 ======================

  /**
   * ShadowCard - Shadow DOM 样式隔离的卡片组件
   * 在 Shadow DOM 中渲染卡片，避免外部样式污染
   * 与轻量级 cf-card 共存，可选使用
   */
  class ShadowCardRegistry {
    constructor() {
      this._styles = new Map();      // type -> css string
      this._templates = new Map();   // type -> html template string
      this._defined = new Set();
    }

    /**
     * 注册卡片类型的 Shadow DOM 样式
     */
    registerStyle(type, css) {
      if (!type || typeof css !== 'string') return false;
      this._styles.set(type, css);
      return true;
    }

    /**
     * 注册卡片类型的 Shadow DOM 模板
     */
    registerTemplate(type, html) {
      if (!type || typeof html !== 'string') return false;
      this._templates.set(type, html);
      return true;
    }

    getStyle(type) {
      return this._styles.get(type) || '';
    }

    getTemplate(type) {
      return this._templates.get(type) || '<div class="cf-shadow-content">${title}</div>';
    }

    hasType(type) {
      return this._styles.has(type) || this._templates.has(type);
    }

    clear() {
      this._styles.clear();
      this._templates.clear();
    }
  }

  /**
   * 工具：构造一个支持 Shadow DOM 的自定义元素
   * 避免与已有的 cf-card 冲突，新元素名为 cf-shadow-card
   */
  function defineShadowCardElement(registry) {
    if (typeof customElements === 'undefined') return null;
    if (customElements.get('cf-shadow-card')) return customElements.get('cf-shadow-card');

    class ShadowCardElement extends HTMLElement {
      static get observedAttributes() {
        return ['type', 'data-card-id', 'data-props'];
      }

      constructor() {
        super();
        this._props = {};
        this._initialized = false;
        this._listeners = new Map();
        this._attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this._initialize();
      }

      disconnectedCallback() {
        this._cleanup();
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        if (name === 'data-props' && newValue) {
          try {
            this._props = JSON.parse(newValue);
          } catch (e) {
            this._props = {};
          }
        }
        if (this._initialized) {
          this._render();
        }
      }

      _initialize() {
        if (this._initialized) return;
        this._initialized = true;
        this._render();
      }

      _render() {
        const type = this.getAttribute('type') || 'text';
        const style = registry.getStyle(type);
        const template = registry.getTemplate(type);

        // 简单模板替换 ${prop}
        let html = template;
        Object.keys(this._props).forEach(key => {
          const re = new RegExp('\\$\\{' + key + '\\}', 'g');
          const value = String(this._props[key] ?? '');
          html = html.replace(re, this._escapeHtml(value));
        });
        // 未填充的占位符使用空字符串
        html = html.replace(/\$\{[^}]+\}/g, '');

        this.shadowRoot.innerHTML = `
          <style>${style}</style>
          <div class="cf-shadow-wrapper" data-type="${this._escapeAttr(type)}">
            ${html}
            <slot name="footer"></slot>
            <slot></slot>
          </div>
        `;
      }

      _escapeHtml(s) {
        if (s == null) return '';
        return String(s)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;')
          .replace(/`/g, '&#96;')
          .replace(/=/g, '&#61;');
      }

      _escapeAttr(s) {
        return String(s).replace(/"/g, '&quot;');
      }

      /**
       * 设置 props
       */
      setProps(props) {
        this._props = Object.assign({}, this._props, props || {});
        this.setAttribute('data-props', JSON.stringify(this._props));
      }

      /**
       * 获取 props
       */
      getProps() {
        return Object.assign({}, this._props);
      }

      /**
       * 派发自定义事件
       */
      emit(name, detail) {
        const event = new CustomEvent(name, {
          detail,
          bubbles: true,
          composed: true   // 跨 Shadow DOM 边界冒泡
        });
        this.dispatchEvent(event);
      }

      /**
       * 监听自定义事件，支持自动清理
       */
      on(name, handler) {
        const wrapped = (e) => handler(e.detail, e);
        this.addEventListener(name, wrapped);
        this._listeners.set(handler, { name, wrapped });
        return () => this.off(name, handler);
      }

      off(name, handler) {
        const entry = this._listeners.get(handler);
        if (entry) {
          this.removeEventListener(entry.name, entry.wrapped);
          this._listeners.delete(handler);
        }
      }

      _cleanup() {
        this._listeners.clear();
      }
    }

    customElements.define('cf-shadow-card', ShadowCardElement);
    return ShadowCardElement;
  }

  class I18nManager {
    constructor(container = null) {
      this.currentLocale = 'zh-CN';
      this.locales = new Map();
      this._fallbackLocale = 'en-US';
      this.container = container;
      this._rtlLocales = ['ar', 'ar-', 'he', 'he-', 'fa', 'fa-', 'ur', 'ur-', 'ps', 'ps-', 'sd', 'sd-', 'dv', 'dv-', 'yi', 'yi-'];

      this._registerDefaultLocales();
    }

    setContainer(container) {
      this.container = container;
      this._updateContainerDir();
    }

    _registerDefaultLocales() {
      this.registerLocale('zh-CN', {
        label: '简体中文',
        messages: {
          'card.title.default': '未命名卡片',
          'card.error.render': '卡片渲染错误',
          'card.error.unknownType': '未知类型',
          'card.error.retry': '重试',
          'card.error.delete': '删除',
          'plugin.install.success': '插件安装成功',
          'plugin.uninstall.success': '插件已卸载',
          'plugin.enable.success': '插件已启用',
          'plugin.disable.success': '插件已禁用',
          'theme.changed': '主题已切换',
          'validation.required': '必填属性缺失',
          'validation.typeError': '类型错误',
          'validation.allowedValues': '值不在允许列表中',
          'autofix.defaultValue': '已填充默认值',
          'autofix.rollback': '已回滚到默认值',
          'circuitBreaker.opened': '熔断已触发',
          'circuitBreaker.closed': '熔断已恢复'
        }
      });

      this.registerLocale('en-US', {
        label: 'English',
        messages: {
          'card.title.default': 'Untitled Card',
          'card.error.render': 'Card Render Error',
          'card.error.unknownType': 'Unknown Type',
          'card.error.retry': 'Retry',
          'card.error.delete': 'Delete',
          'plugin.install.success': 'Plugin installed successfully',
          'plugin.uninstall.success': 'Plugin uninstalled',
          'plugin.enable.success': 'Plugin enabled',
          'plugin.disable.success': 'Plugin disabled',
          'theme.changed': 'Theme changed',
          'validation.required': 'Required property missing',
          'validation.typeError': 'Type error',
          'validation.allowedValues': 'Value not in allowed list',
          'autofix.defaultValue': 'Filled with default value',
          'autofix.rollback': 'Rolled back to default value',
          'circuitBreaker.opened': 'Circuit breaker opened',
          'circuitBreaker.closed': 'Circuit breaker closed'
        }
      });

      this.registerLocale('ja-JP', {
        label: '日本語',
        messages: {
          'card.title.default': '無題のカード',
          'card.error.render': 'カードレンダリングエラー',
          'card.error.unknownType': '不明なタイプ',
          'card.error.retry': '再試行',
          'card.error.delete': '削除',
          'plugin.install.success': 'プラグインのインストールに成功しました',
          'plugin.uninstall.success': 'プラグインをアンインストールしました',
          'plugin.enable.success': 'プラグインが有効になりました',
          'plugin.disable.success': 'プラグインが無効になりました',
          'theme.changed': 'テーマが変更されました',
          'validation.required': '必須項目が欠落しています',
          'validation.typeError': 'タイプエラー',
          'validation.allowedValues': '値が許可されたリストにありません',
          'autofix.defaultValue': 'デフォルト値で埋めました',
          'autofix.rollback': 'デフォルト値にロールバックしました',
          'circuitBreaker.opened': 'サーキットブレーカーがオープンしました',
          'circuitBreaker.closed': 'サーキットブレーカーがクローズしました'
        }
      });

      this.registerLocale('ko-KR', {
        label: '한국어',
        messages: {
          'card.title.default': '제목 없는 카드',
          'card.error.render': '카드 렌더링 오류',
          'card.error.unknownType': '알 수 없는 유형',
          'card.error.retry': '재시도',
          'card.error.delete': '삭제',
          'plugin.install.success': '플러그인 설치 성공',
          'plugin.uninstall.success': '플러그인 제거됨',
          'plugin.enable.success': '플러그인 활성화됨',
          'plugin.disable.success': '플러그인 비활성화됨',
          'theme.changed': '테마가 변경되었습니다',
          'validation.required': '필수 속성이 누락되었습니다',
          'validation.typeError': '유형 오류',
          'validation.allowedValues': '값이 허용 목록에 없습니다',
          'autofix.defaultValue': '기본값으로 채워졌습니다',
          'autofix.rollback': '기본값으로 롤백되었습니다',
          'circuitBreaker.opened': '회로 차단기가 열렸습니다',
          'circuitBreaker.closed': '회로 차단기가 닫혔습니다'
        }
      });

      this.registerLocale('fr-FR', {
        label: 'Français',
        messages: {
          'card.title.default': 'Carte sans titre',
          'card.error.render': 'Erreur de rendu de carte',
          'card.error.unknownType': 'Type inconnu',
          'card.error.retry': 'Réessayer',
          'card.error.delete': 'Supprimer',
          'plugin.install.success': 'Plugin installé avec succès',
          'plugin.uninstall.success': 'Plugin désinstallé',
          'plugin.enable.success': 'Plugin activé',
          'plugin.disable.success': 'Plugin désactivé',
          'theme.changed': 'Thème changé',
          'validation.required': 'Propriété requise manquante',
          'validation.typeError': 'Erreur de type',
          'validation.allowedValues': 'Valeur hors de la liste autorisée',
          'autofix.defaultValue': 'Rempli avec la valeur par défaut',
          'autofix.rollback': 'Rétabli à la valeur par défaut',
          'circuitBreaker.opened': 'Disjoncteur ouvert',
          'circuitBreaker.closed': 'Disjoncteur fermé'
        }
      });

      this.registerLocale('es-ES', {
        label: 'Español',
        messages: {
          'card.title.default': 'Tarjeta sin título',
          'card.error.render': 'Error de renderizado de tarjeta',
          'card.error.unknownType': 'Tipo desconocido',
          'card.error.retry': 'Reintentar',
          'card.error.delete': 'Eliminar',
          'plugin.install.success': 'Plugin instalado con éxito',
          'plugin.uninstall.success': 'Plugin desinstalado',
          'plugin.enable.success': 'Plugin habilitado',
          'plugin.disable.success': 'Plugin deshabilitado',
          'theme.changed': 'Tema cambiado',
          'validation.required': 'Propiedad requerida faltante',
          'validation.typeError': 'Error de tipo',
          'validation.allowedValues': 'Valor fuera de la lista permitida',
          'autofix.defaultValue': 'Rellenado con valor por defecto',
          'autofix.rollback': 'Restaurado al valor por defecto',
          'circuitBreaker.opened': 'Disyuntor abierto',
          'circuitBreaker.closed': 'Disyuntor cerrado'
        }
      });

      this.registerLocale('de-DE', {
        label: 'Deutsch',
        messages: {
          'card.title.default': 'Unbenannte Karte',
          'card.error.render': 'Karten-Rendering-Fehler',
          'card.error.unknownType': 'Unbekannter Typ',
          'card.error.retry': 'Wiederholen',
          'card.error.delete': 'Löschen',
          'plugin.install.success': 'Plugin erfolgreich installiert',
          'plugin.uninstall.success': 'Plugin deinstalliert',
          'plugin.enable.success': 'Plugin aktiviert',
          'plugin.disable.success': 'Plugin deaktiviert',
          'theme.changed': 'Theme gewechselt',
          'validation.required': 'Pflichtfeld fehlt',
          'validation.typeError': 'Typfehler',
          'validation.allowedValues': 'Wert nicht in der erlaubten Liste',
          'autofix.defaultValue': 'Mit Standardwert gefüllt',
          'autofix.rollback': 'Auf Standardwert zurückgesetzt',
          'circuitBreaker.opened': 'Schutzschalter geöffnet',
          'circuitBreaker.closed': 'Schutzschalter geschlossen'
        }
      });
    }

    registerLocale(locale, localeDef) {
      if (!locale || !localeDef) {
        throw new Error('locale 和 localeDef 都是必填的');
      }

      this.locales.set(locale, {
        locale,
        label: localeDef.label || locale,
        messages: localeDef.messages || {},
        rtl: localeDef.rtl || false
      });

      return true;
    }

    getLocale(locale) {
      return this.locales.get(locale) || null;
    }

    getAllLocales() {
      return Array.from(this.locales.values()).map(l => ({
        locale: l.locale,
        label: l.label,
        rtl: l.rtl
      }));
    }

    setLocale(locale) {
      if (!this.locales.has(locale)) {
        FeedbackSystem.warn(`语言 "${locale}" 不存在`);
        return false;
      }

      this.currentLocale = locale;

      const localeDef = this.locales.get(locale);
      const isRTL = localeDef.rtl || this._isRTLLocale(locale);
      
      if (document.documentElement) {
        document.documentElement.lang = locale;
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      }

      this._updateContainerDir();

      eventBus.emit(EVENT_TYPES.LANGUAGE_CHANGED, { locale, rtl: isRTL });
      return true;
    }

    _updateContainerDir() {
      if (this.container) {
        const isRTL = this.isRTL();
        this.container.dir = isRTL ? 'rtl' : 'ltr';
        this.container.dataset.dir = isRTL ? 'rtl' : 'ltr';
      }
    }

    isRTL(locale = null) {
      const targetLocale = locale || this.currentLocale;
      const localeDef = this.locales.get(targetLocale);
      if (localeDef && localeDef.rtl !== undefined) {
        return localeDef.rtl;
      }
      return this._isRTLLocale(targetLocale);
    }

    _isRTLLocale(locale) {
      if (!locale) return false;
      const lowerLocale = locale.toLowerCase();
      return this._rtlLocales.some(rtlPrefix => lowerLocale.startsWith(rtlPrefix));
    }

    getCurrentLocale() {
      return this.currentLocale;
    }

    t(key, params = {}) {
      const locale = this.locales.get(this.currentLocale);
      let message = locale ? locale.messages[key] : null;

      if (!message) {
        const fallback = this.locales.get(this._fallbackLocale);
        message = fallback ? fallback.messages[key] : null;
      }

      if (!message) {
        return key;
      }

      return message.replace(/\{(\w+)\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }

    detectBrowserLocale() {
      if (typeof navigator === 'undefined') return 'en-US';
      
      const browserLocale = navigator.language || navigator.userLanguage || 'en-US';
      
      if (this.locales.has(browserLocale)) {
        return browserLocale;
      }

      const shortLocale = browserLocale.split('-')[0];
      for (const locale of this.locales.keys()) {
        if (locale.startsWith(shortLocale)) {
          return locale;
        }
      }

      return 'en-US';
    }

    setFallbackLocale(locale) {
      this._fallbackLocale = locale;
    }
  }

  class RelationshipEngine {
    constructor(container, store) {
      this.container = container;
      this.store = store;
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
        eventBus.emit('relationshipClick', { relationship: rel, event: e });
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
        eventBus.emit('relationshipCreatedByDrag', {
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

      tooltip.innerHTML = `
        <div><strong>关系类型:</strong> ${rel.type}</div>
        <div><strong>源:</strong> ${sourceCard?.props?.title || rel.sourceId}</div>
        <div><strong>目标:</strong> ${targetCard?.props?.title || rel.targetId}</div>
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
        eventBus.emit('relationshipTypeChanged', { relationshipId: rel.id, oldType: rel.type, newType: types[index] });
      }
    }

    _deleteRelationship(rel) {
      if (confirm(`确定删除此关系吗？\n类型: ${rel.type}`)) {
        this.store.removeRelationship(rel.id);
        eventBus.emit('relationshipDeletedByContext', { relationshipId: rel.id });
      }
    }

    refresh() {
      this._renderLines();
    }
  }

  class PluginManager {
    constructor(frame) {
      this.frame = frame;
      this.plugins = new Map();
      this._hooks = new Map();
      this._permissions = new Map();
      this._callCounts = new Map();
      this._maxCallsPerMinute = 1000;
    }

    /**
     * 注册插件权限
     * @param {string} pluginName - 插件名
     * @param {string[]} permissions - 权限列表
     */
    registerPermissions(pluginName, permissions) {
      this._permissions.set(pluginName, new Set(permissions || []));
    }

    /**
     * 检查插件是否有指定权限
     * @param {string} pluginName - 插件名
     * @param {string} permission - 权限名
     * @returns {boolean}
     */
    hasPermission(pluginName, permission) {
      const perms = this._permissions.get(pluginName);
      if (!perms) return false;
      return perms.has(permission) || perms.has('*');
    }

    /**
     * 检查插件调用频率
     * @param {string} pluginName - 插件名
     * @returns {boolean} 是否允许继续调用
     */
    checkRateLimit(pluginName) {
      const now = Date.now();
      const key = `${pluginName}:${Math.floor(now / 60000)}`;
      const count = (this._callCounts.get(key) || 0) + 1;
      this._callCounts.set(key, count);
      // 清理旧记录
      this._callCounts.forEach((_, k) => {
        if (parseInt(k.split(':')[1]) < Math.floor(now / 60000) - 1) {
          this._callCounts.delete(k);
        }
      });
      return count <= this._maxCallsPerMinute;
    }

    /**
     * 获取插件的安全上下文（沙箱接口）
     * @param {string} pluginName - 插件名
     * @returns {object} 沙箱化的上下文
     */
    getSandboxContext(pluginName) {
      const frame = this.frame;
      const can = (perm) => this.hasPermission(pluginName, perm);

      return {
        // 安全的数据访问
        store: can('store:read') ? {
          getCard: (id) => frame.store.getCard(id),
          getAllCards: () => frame.store.getAllCards(),
          getCardsByType: (type) => frame.store.getCardsByType(type),
          getRelationship: (id) => frame.store.getRelationship(id),
          getAllRelationships: () => frame.store.getAllRelationships()
        } : null,

        // 安全的写操作
        storeWrite: can('store:write') ? {
          addCard: (card) => {
            if (!this.checkRateLimit(pluginName)) {
              FeedbackSystem.warn('plugin_rate_limit', `插件 "${pluginName}" 操作频率超限`);
              return null;
            }
            return frame.store.addCard(card);
          },
          updateCard: (card) => {
            if (!this.checkRateLimit(pluginName)) return null;
            return frame.store.updateCard(card);
          }
        } : null,

        // 事件系统（只读）
        eventBus: can('events:subscribe') ? {
          on: (event, handler) => frame.eventBus.on(event, handler),
          off: (event, handler) => frame.eventBus.off(event, handler)
        } : null,

        // 类型注册
        typeRegistry: can('types:register') ? {
          register: (def) => frame.typeRegistry.register(def),
          get: (name) => frame.typeRegistry.get(name)
        } : null,

        // 国际化
        i18n: can('i18n:read') ? {
          t: (key, params) => frame.i18n.t(key, params),
          getLocale: () => frame.i18n.getLocale()
        } : null,

        // 主题
        theme: can('theme:read') ? {
          getCurrentTheme: () => frame.themeManager.getCurrentTheme()
        } : null,

        // 反馈
        feedback: {
          info: (type, msg, opts) => FeedbackSystem.info(type, msg, opts),
          warn: (type, msg, opts) => FeedbackSystem.warn(type, msg, opts),
          error: (type, msg, opts) => FeedbackSystem.error(type, msg, opts)
        },

        // 工具
        utils: can('utils:read') ? {
          generateId: (p) => Utils.generateId(p),
          escapeHtml: (s) => Utils.escapeHtml(s),
          deepClone: (o) => Utils.deepClone(o)
        } : null
      };
    }

    registerHook(hookName, handler) {
      if (!this._hooks.has(hookName)) {
        this._hooks.set(hookName, new Set());
      }
      this._hooks.get(hookName).add(handler);
      return () => this._hooks.get(hookName).delete(handler);
    }

    triggerHook(hookName, data) {
      const hooks = this._hooks.get(hookName);
      if (!hooks) return data;
      
      let result = data;
      hooks.forEach(handler => {
        try {
          result = handler(result, this.frame) || result;
        } catch (e) {
          console.error(`[CardFrame] 插件钩子 "${hookName}" 执行错误:`, e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'plugin_error',
            message: `插件钩子 "${hookName}" 执行错误: ${e.message}`,
            error: e,
            context: { hookName, phase: 'triggerHook' },
            timestamp: Date.now()
          });
        }
      });
      return result;
    }

    install(pluginDef) {
      if (!pluginDef || !pluginDef.name) {
        throw new Error('插件必须定义 name 属性');
      }

      if (this.plugins.has(pluginDef.name)) {
        FeedbackSystem.warn(`插件 "${pluginDef.name}" 已安装`);
        return false;
      }

      if (pluginDef.dependencies) {
        for (const dep of pluginDef.dependencies) {
          if (!this.plugins.has(dep)) {
            throw new Error(`插件 "${pluginDef.name}" 依赖 "${dep}"，请先安装该插件`);
          }
        }
      }

      const plugin = {
        name: pluginDef.name,
        version: pluginDef.version || '1.0.0',
        description: pluginDef.description || '',
        author: pluginDef.author || '',
        dependencies: pluginDef.dependencies || [],
        enabled: false,
        instance: null,
        _def: pluginDef
      };

      if (typeof pluginDef.install === 'function') {
        try {
          plugin.instance = pluginDef.install(this.frame) || {};
        } catch (e) {
          console.error(`[CardFrame] 插件 "${pluginDef.name}" 安装失败:`, e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'plugin_error',
            message: `插件 "${pluginDef.name}" 安装失败: ${e.message}`,
            error: e,
            context: { pluginName: pluginDef.name, phase: 'install' },
            timestamp: Date.now()
          });
          throw e;
        }
      }

      this.plugins.set(plugin.name, plugin);

      if (pluginDef.cardTypes) {
        const skipCheck = pluginDef.unsafeSkipTemplateCheck === true;
        pluginDef.cardTypes.forEach(typeDef => {
          if (!skipCheck && typeDef.renderTemplate) {
            const securityResult = Security.checkTemplateSecurity(typeDef.renderTemplate);
            if (!securityResult.safe) {
              securityResult.issues.forEach(issue => {
                FeedbackSystem.warn(
                  `插件 "${pluginDef.name}" 的卡片类型 "${typeDef.type}" 模板存在安全问题`,
                  issue.message,
                  '如确认安全可设置 unsafeSkipTemplateCheck: true 跳过检查'
                );
              });
            }
          }
          this.frame.typeRegistry.register(typeDef);
        });
      }

      if (pluginDef.actions) {
        this._registerPluginActions(pluginDef.name, pluginDef.actions);
      }

      if (pluginDef.hooks) {
        for (const [hookName, handler] of Object.entries(pluginDef.hooks)) {
          this.registerHook(hookName, handler);
        }
      }

      if (pluginDef.autoEnable !== false) {
        this.enable(plugin.name);
      }

      eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, { pluginName: plugin.name, version: plugin.version });
      FeedbackSystem.info(`插件 "${plugin.name}" 安装成功`, `版本: ${plugin.version}`);
      
      return true;
    }

    uninstall(pluginName) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
        return false;
      }

      const dependents = [];
      this.plugins.forEach((p, name) => {
        if (p.dependencies.includes(pluginName)) {
          dependents.push(name);
        }
      });
      if (dependents.length > 0) {
        throw new Error(`无法卸载插件 "${pluginName}"，以下插件依赖它: ${dependents.join(', ')}`);
      }

      if (plugin.enabled) {
        this.disable(pluginName);
      }

      if (plugin._def.uninstall && typeof plugin._def.uninstall === 'function') {
        try {
          plugin._def.uninstall(this.frame, plugin.instance);
        } catch (e) {
          console.error(`[CardFrame] 插件 "${pluginName}" 卸载钩子执行错误:`, e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'plugin_error',
            message: `插件 "${pluginName}" 卸载钩子执行错误: ${e.message}`,
            error: e,
            context: { pluginName, phase: 'uninstall' },
            timestamp: Date.now()
          });
        }
      }

      this.plugins.delete(pluginName);
      eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, { pluginName });
      FeedbackSystem.info(`插件 "${pluginName}" 已卸载`);
      
      return true;
    }

    enable(pluginName) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
        return false;
      }

      if (plugin.enabled) {
        return true;
      }

      if (plugin._def.enable && typeof plugin._def.enable === 'function') {
        try {
          plugin._def.enable(this.frame, plugin.instance);
        } catch (e) {
          console.error(`[CardFrame] 插件 "${pluginName}" 启用失败:`, e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'plugin_error',
            message: `插件 "${pluginName}" 启用失败: ${e.message}`,
            error: e,
            context: { pluginName, phase: 'enable' },
            timestamp: Date.now()
          });
          return false;
        }
      }

      plugin.enabled = true;
      eventBus.emit(EVENT_TYPES.PLUGIN_ENABLED, { pluginName });
      FeedbackSystem.info(`插件 "${pluginName}" 已启用`);
      
      return true;
    }

    disable(pluginName) {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        FeedbackSystem.warn(`插件 "${pluginName}" 未安装`);
        return false;
      }

      if (!plugin.enabled) {
        return true;
      }

      if (plugin._def.disable && typeof plugin._def.disable === 'function') {
        try {
          plugin._def.disable(this.frame, plugin.instance);
        } catch (e) {
          console.error(`[CardFrame] 插件 "${pluginName}" 禁用失败:`, e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'plugin_error',
            message: `插件 "${pluginName}" 禁用失败: ${e.message}`,
            error: e,
            context: { pluginName, phase: 'disable' },
            timestamp: Date.now()
          });
          return false;
        }
      }

      plugin.enabled = false;
      eventBus.emit(EVENT_TYPES.PLUGIN_DISABLED, { pluginName });
      FeedbackSystem.info(`插件 "${pluginName}" 已禁用`);
      
      return true;
    }

    get(pluginName) {
      const plugin = this.plugins.get(pluginName);
      return plugin ? plugin.instance : null;
    }

    getAll() {
      return Array.from(this.plugins.values()).map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        author: p.author,
        enabled: p.enabled,
        dependencies: p.dependencies
      }));
    }

    isInstalled(pluginName) {
      return this.plugins.has(pluginName);
    }

    isEnabled(pluginName) {
      const plugin = this.plugins.get(pluginName);
      return plugin ? plugin.enabled : false;
    }

    _registerPluginActions(pluginName, actions) {
    }
  }

  class Store {
    constructor() {
      this.cards = new Map();
      this.relationships = new Map();
      this.listeners = new Set();
      this._index = new QueryIndex();
    }

    /**
     * 获取查询索引实例
     */
    getIndex() {
      return this._index;
    }

    addCard(card) {
      const newCard = { ...card, updatedAt: Date.now() };
      if (!newCard.position) {
        newCard.position = { x: 0, y: 0 };
      }
      this.cards.set(newCard.id, newCard);
      this._index.add(newCard);
      this.notify();
      eventBus.emit(EVENT_TYPES.CARD_ADDED, { card: newCard });
      return newCard;
    }

    updateCard(card) {
      if (!this.cards.has(card.id)) return null;
      const updatedCard = { ...card, updatedAt: Date.now() };
      this.cards.set(updatedCard.id, updatedCard);
      this._index.add(updatedCard);
      this.notify();
      eventBus.emit(EVENT_TYPES.CARD_UPDATED, { card: updatedCard });
      return updatedCard;
    }

    updateCardProps(id, props) {
      const card = this.getCard(id);
      if (!card) return null;
      card.props = { ...card.props, ...props };
      return this.updateCard(card);
    }

    removeCard(id) {
      if (!this.cards.has(id)) return false;
      const card = this.cards.get(id);
      this.cards.delete(id);
      this._index.remove(id);
      const relIdsToDelete = [];
      this.relationships.forEach((rel, relId) => {
        if (rel.sourceId === id || rel.targetId === id) {
          relIdsToDelete.push(relId);
        }
      });
      relIdsToDelete.forEach(relId => this.relationships.delete(relId));
      this.notify();
      eventBus.emit(EVENT_TYPES.CARD_REMOVED, { cardId: id, card });
      return true;
    }

    getCard(id) {
      return this.cards.get(id);
    }

    getAllCards() {
      return Array.from(this.cards.values());
    }

    /**
     * 通过索引快速按类型查询（O(1) 数量级）
     */
    getCardsByType(type) {
      const ids = this._index.queryByType(type);
      const result = [];
      ids.forEach(id => {
        const c = this.cards.get(id);
        if (c) result.push(c);
      });
      return result;
    }

    /**
     * 通过索引快速按标签查询
     */
    getCardsByTag(tag) {
      const ids = this._index.queryByTag(tag);
      const result = [];
      ids.forEach(id => {
        const c = this.cards.get(id);
        if (c) result.push(c);
      });
      return result;
    }

    /**
     * 通过索引快速按状态查询
     */
    getCardsByStatus(status) {
      const ids = this._index.queryByStatus(status);
      const result = [];
      ids.forEach(id => {
        const c = this.cards.get(id);
        if (c) result.push(c);
      });
      return result;
    }

    /**
     * 多条件查询（type + tag + status 交集）
     */
    queryCards(criteria) {
      const ids = this._index.query(criteria || {});
      const result = [];
      ids.forEach(id => {
        const c = this.cards.get(id);
        if (c) result.push(c);
      });
      return result;
    }

    addRelationship(rel) {
      const newRel = { 
        id: rel.id || Utils.generateId('rel'),
        type: rel.type || 'reference',
        ...rel, 
        createdAt: Date.now() 
      };
      this.relationships.set(newRel.id, newRel);
      this.notify();
      eventBus.emit(EVENT_TYPES.RELATIONSHIP_ADDED, { relationship: newRel });
      return newRel;
    }

    updateRelationship(rel) {
      if (!this.relationships.has(rel.id)) return null;
      const updatedRel = { ...rel, updatedAt: Date.now() };
      this.relationships.set(updatedRel.id, updatedRel);
      this.notify();
      return updatedRel;
    }

    removeRelationship(id) {
      if (!this.relationships.has(id)) return false;
      const rel = this.relationships.get(id);
      this.relationships.delete(id);
      this.notify();
      eventBus.emit(EVENT_TYPES.RELATIONSHIP_REMOVED, { relationshipId: id, relationship: rel });
      return true;
    }

    getRelationship(id) {
      return this.relationships.get(id);
    }

    getAllRelationships() {
      return Array.from(this.relationships.values());
    }

    getRelationshipsByCard(cardId) {
      return Array.from(this.relationships.values()).filter(
        rel => rel.sourceId === cardId || rel.targetId === cardId
      );
    }

    getRelationshipsByType(type) {
      return this.getAllRelationships().filter(rel => rel.type === type);
    }

    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw new Error('订阅者必须是函数');
      }
      this.listeners.add(listener);
      const unsubscribe = () => {
        return this.unsubscribe(listener);
      };
      unsubscribe.listener = listener;
      return unsubscribe;
    }

    unsubscribe(listener) {
      if (!listener) return false;
      if (typeof listener === 'function') {
        return this.listeners.delete(listener);
      }
      if (listener.listener && typeof listener.listener === 'function') {
        return this.listeners.delete(listener.listener);
      }
      return false;
    }

    getSubscriberCount() {
      return this.listeners.size;
    }

    notify() {
      // try { listener(); } catch (e) { console.error(e); }
      this.listeners.forEach(listener => {
        try { listener(); } catch (e) {
          console.error(e);
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'store_error',
            message: `Store 订阅者通知错误: ${e.message}`,
            error: e,
            context: { phase: 'notify', subscriberCount: this.listeners.size },
            timestamp: Date.now()
          });
        }
      });
    }

    toJSON() {
      return {
        cards: this.getAllCards(),
        relationships: this.getAllRelationships()
      };
    }

    static fromJSON(data) {
      const store = new Store();
      if (data.cards) {
        data.cards.forEach(card => store.cards.set(card.id, card));
      }
      if (data.relationships) {
        data.relationships.forEach(rel => store.relationships.set(rel.id, rel));
      }
      return store;
    }
  }

  class TypeRegistry {
    constructor() {
      this.types = new Map();
    }

    register(typeDef) {
      if (this.types.has(typeDef.type)) {
        FeedbackSystem.warn(`类型 "${typeDef.type}" 已存在`);
        return false;
      }
      const finalTypeDef = this.resolveInheritance(typeDef);
      this.types.set(typeDef.type, finalTypeDef);
      return true;
    }

    resolveInheritance(typeDef) {
      if (!typeDef.extends) return { ...typeDef };
      
      const parentDef = this.get(typeDef.extends);
      if (!parentDef) {
        FeedbackSystem.warn(`父类型 "${typeDef.extends}" 不存在`);
        return { ...typeDef };
      }

      const resolvedParent = this.resolveInheritance(parentDef);
      const mergedProps = [...resolvedParent.propsSchema];
      
      typeDef.propsSchema.forEach(prop => {
        const existingIndex = mergedProps.findIndex(p => p.name === prop.name);
        if (existingIndex >= 0) {
          mergedProps[existingIndex] = { ...mergedProps[existingIndex], ...prop };
        } else {
          mergedProps.push(prop);
        }
      });

      return {
        ...resolvedParent,
        ...typeDef,
        abstract: typeDef.abstract === true,
        propsSchema: mergedProps,
        renderTemplate: typeDef.renderTemplate || resolvedParent.renderTemplate,
        actions: typeDef.actions ? [...(resolvedParent.actions || []), ...typeDef.actions] : resolvedParent.actions,
        defaultStyle: { ...(resolvedParent.defaultStyle || {}), ...(typeDef.defaultStyle || {}) }
      };
    }

    get(typeName) {
      return this.types.get(typeName);
    }

    getAll() {
      return Array.from(this.types.values());
    }

    validate(card) {
      const typeDef = this.get(card.type);
      if (!typeDef) {
        return { valid: false, errors: [`类型 "${card.type}" 未定义`] };
      }

      const errors = [];
      const warnings = [];
      const sanitizedProps = {};
      let hasSanitized = false;

      typeDef.propsSchema.forEach(prop => {
        const value = card.props[prop.name];
        
        if (prop.required && (value === undefined || value === null || value === '')) {
          errors.push({
            type: 'required',
            prop: prop.name,
            message: `必填属性 "${prop.name}" 缺失`
          });
        } else if (value !== undefined && value !== null && value !== '' && prop.type && !Utils.validateType(value, prop.type)) {
          errors.push({
            type: 'type',
            prop: prop.name,
            message: `属性 "${prop.name}" 类型错误，期望 ${prop.type}`
          });
        } else if (value !== undefined && value !== null && value !== '' && prop.allowedValues && !prop.allowedValues.includes(value)) {
          errors.push({
            type: 'allowedValues',
            prop: prop.name,
            message: `属性 "${prop.name}" 值 "${value}" 不在允许列表中`,
            allowedValues: prop.allowedValues
          });
        } else if (value !== undefined && value !== null && value !== '' && prop.validator && !prop.validator(value)) {
          errors.push({
            type: 'custom',
            prop: prop.name,
            message: `属性 "${prop.name}" 验证失败`
          });
        }

        if (value !== undefined && value !== null && value !== '') {
          const securityResult = Security.validatePropValue(value, prop);
          if (!securityResult.valid) {
            errors.push({
              type: 'security',
              prop: prop.name,
              message: `属性 "${prop.name}" 安全验证失败：${securityResult.error}`,
              severity: 'high'
            });
          }
          if (securityResult.value !== value) {
            sanitizedProps[prop.name] = securityResult.value;
            hasSanitized = true;
            warnings.push({
              type: 'sanitized',
              prop: prop.name,
              message: securityResult.warning || `属性 "${prop.name}" 已安全清理`
            });
          }
        }
      });

      const result = { valid: errors.length === 0, errors, warnings };
      if (hasSanitized) {
        result.sanitizedProps = sanitizedProps;
      }
      return result;
    }

    sanitizeCard(card) {
      const typeDef = this.get(card.type);
      if (!typeDef) return card;

      const sanitizedCard = { ...card, props: { ...card.props } };

      typeDef.propsSchema.forEach(prop => {
        const value = sanitizedCard.props[prop.name];
        if (value !== undefined && value !== null) {
          const securityResult = Security.validatePropValue(value, prop);
          sanitizedCard.props[prop.name] = securityResult.value;
        }
      });

      return sanitizedCard;
    }

    getPropSchema(typeName, propName) {
      const typeDef = this.get(typeName);
      if (!typeDef) return undefined;
      return typeDef.propsSchema.find(p => p.name === propName);
    }

    getDefaultValue(typeName, propName) {
      const propSchema = this.getPropSchema(typeName, propName);
      return propSchema ? propSchema.defaultValue : undefined;
    }
  }

  class AutoFixer {
    constructor(typeRegistry, store, container = null) {
      this.typeRegistry = typeRegistry;
      this.store = store;
      this.container = container;
      this.enabled = true;
      this._fixStats = {
        totalFixes: 0,
        cardFixes: 0,
        domSyncFixes: 0,
        relationshipFixes: 0
      };
    }

    setContainer(container) {
      this.container = container;
    }

    setEnabled(enabled) {
      this.enabled = enabled;
    }

    fixCard(card, validationResult) {
      if (!this.enabled) return { fixed: false, changes: [] };
      
      const changes = [];
      const typeDef = this.typeRegistry.get(card.type);
      if (!typeDef) return { fixed: false, changes: [] };

      validationResult.errors.forEach(error => {
        if (error.type === 'required') {
          const defaultValue = this.typeRegistry.getDefaultValue(card.type, error.prop);
          if (defaultValue !== undefined) {
            card.props[error.prop] = defaultValue;
            changes.push({ prop: error.prop, fix: 'defaultValue', value: defaultValue });
            FeedbackSystem.fix(`属性 "${error.prop}" 缺失，已填充默认值：${defaultValue}`);
          }
        } else if (error.type === 'type') {
          const propSchema = this.typeRegistry.getPropSchema(card.type, error.prop);
          if (propSchema && propSchema.defaultValue !== undefined) {
            card.props[error.prop] = propSchema.defaultValue;
            changes.push({ prop: error.prop, fix: 'rollback', value: propSchema.defaultValue });
            FeedbackSystem.fix(`属性 "${error.prop}" 类型错误，已回滚到默认值`);
          }
        } else if (error.type === 'allowedValues') {
          const propSchema = this.typeRegistry.getPropSchema(card.type, error.prop);
          if (propSchema && propSchema.defaultValue !== undefined) {
            card.props[error.prop] = propSchema.defaultValue;
            changes.push({ prop: error.prop, fix: 'allowedValuesFallback', value: propSchema.defaultValue });
            FeedbackSystem.fix(
              `属性 "${error.prop}" 值不在允许列表中`,
              `允许值：${propSchema.allowedValues.join(', ')}，已自动设置为默认值：${propSchema.defaultValue}`
            );
          }
        }
      });

      if (changes.length > 0) {
        this._fixStats.totalFixes++;
        this._fixStats.cardFixes++;
        eventBus.emit(EVENT_TYPES.CARD_AUTO_FIXED, { cardId: card.id, changes });
      }

      return { fixed: changes.length > 0, changes };
    }

    fixStructure(element, expectedParent) {
      if (!this.enabled) return false;
      
      if (element.parentElement !== expectedParent) {
        FeedbackSystem.fix('卡片位置不正确，已自动归位到正确容器');
        expectedParent.appendChild(element);
        this._fixStats.totalFixes++;
        this._fixStats.domSyncFixes++;
        return true;
      }
      return false;
    }

    fixDomStoreSync(mismatches) {
      if (!this.enabled || !this.container) return { fixed: 0, details: [] };
      
      const details = [];
      let fixedCount = 0;

      mismatches.forEach(mismatch => {
        if (mismatch.type === 'store_only') {
          const card = mismatch.card;
          const cardEl = this.container.querySelector(`[data-card-id="${card.id}"]`);
          if (!cardEl) {
            FeedbackSystem.fix(`DOM 中缺失卡片 ${card.id}，已重新渲染`);
            details.push({ type: 'store_only', cardId: card.id, action: 're-rendered' });
            fixedCount++;
          }
        } else if (mismatch.type === 'dom_only') {
          const cardId = mismatch.cardId;
          const domCard = mismatch.domCard;
          const newCard = {
            id: cardId,
            type: domCard.type || 'text',
            props: { title: domCard.title || '未命名卡片' },
            position: { x: 0, y: 0 },
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          this.store.addCard(newCard);
          FeedbackSystem.fix(`Store 中缺失卡片 ${cardId}，已从 DOM 恢复`);
          details.push({ type: 'dom_only', cardId, action: 'restored' });
          fixedCount++;
        } else if (mismatch.type === 'type_mismatch') {
          const card = this.store.getCard(mismatch.cardId);
          if (card) {
            card.type = mismatch.storeType;
            this.store.updateCard(card);
            FeedbackSystem.fix(`卡片 ${mismatch.cardId} 类型不一致，已以 Store 为准同步`);
            details.push({ type: 'type_mismatch', cardId: mismatch.cardId, action: 'synced' });
            fixedCount++;
          }
        }
      });

      if (fixedCount > 0) {
        this._fixStats.totalFixes += fixedCount;
        this._fixStats.domSyncFixes += fixedCount;
      }

      return { fixed: fixedCount, details };
    }

    fixRelationships(errors) {
      if (!this.enabled) return { fixed: 0, details: [] };
      
      const details = [];
      let fixedCount = 0;

      errors.forEach(error => {
        if (error.type === 'missing_source' || error.type === 'missing_target') {
          const rel = this.store.getRelationship(error.relId);
          if (rel) {
            this.store.removeRelationship(error.relId);
            FeedbackSystem.fix(`关系 ${error.relId} 引用了不存在的卡片，已删除`);
            details.push({ 
              type: error.type, 
              relId: error.relId, 
              action: 'removed',
              sourceId: error.sourceId,
              targetId: error.targetId
            });
            fixedCount++;
          }
        }
      });

      if (fixedCount > 0) {
        this._fixStats.totalFixes += fixedCount;
        this._fixStats.relationshipFixes += fixedCount;
      }

      return { fixed: fixedCount, details };
    }

    fixAll() {
      if (!this.enabled) return { cardFixed: 0, domSyncFixed: 0, relationshipFixed: 0 };
      
      const results = {
        cardFixed: 0,
        domSyncFixed: 0,
        relationshipFixed: 0
      };

      const cards = this.store.getAllCards();
      cards.forEach(card => {
        const validation = this.typeRegistry.validate(card);
        if (!validation.valid) {
          const fixResult = this.fixCard(card, validation);
          if (fixResult.fixed) {
            this.store.updateCard(card);
            results.cardFixed++;
          }
        }
      });

      const validator = this._getValidator();
      if (validator && validator._checkDomStoreSync) {
        const syncResult = validator._checkDomStoreSync();
        if (syncResult.mismatches.length > 0) {
          const fixResult = this.fixDomStoreSync(syncResult.mismatches);
          results.domSyncFixed = fixResult.fixed;
        }
      }

      if (validator && validator._checkRelationshipIntegrity) {
        const relResult = validator._checkRelationshipIntegrity();
        if (relResult.errors.length > 0) {
          const fixResult = this.fixRelationships(relResult.errors);
          results.relationshipFixed = fixResult.fixed;
        }
      }

      return results;
    }

    getStats() {
      return { ...this._fixStats };
    }

    resetStats() {
      this._fixStats = {
        totalFixes: 0,
        cardFixes: 0,
        domSyncFixes: 0,
        relationshipFixes: 0
      };
    }

    _getValidator() {
      return null;
    }
  }

  class RealTimeValidator {
    constructor(container, typeRegistry, store, autoFixer) {
      this.container = container;
      this.typeRegistry = typeRegistry;
      this.store = store;
      this.autoFixer = autoFixer;
      this.observer = null;
      this.enabled = true;
      this._isSyncing = false;
      this._timer = null;
      this._checkInterval = DEFAULT_CONFIG.FULL_CHECK_INTERVAL_MS;
      this._lastCheck = 0;
    }

    setEnabled(enabled) {
      this.enabled = enabled;
      if (enabled) {
        if (!this.observer) this.start();
        this._startPeriodicCheck();
      } else {
        if (this.observer) this.stop();
        this._stopPeriodicCheck();
      }
    }

    setCheckInterval(ms) {
      this._checkInterval = ms;
      if (this._timer) {
        this._stopPeriodicCheck();
        this._startPeriodicCheck();
      }
    }

    start() {
      if (this.observer || !this.container) return;
      
      this.observer = new MutationObserver((mutations) => {
        if (!this.enabled || this._isSyncing) return;
        this.handleMutations(mutations);
      });

      this.observer.observe(this.container, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
      });

      this._startPeriodicCheck();
    }

    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this._stopPeriodicCheck();
    }

    _startPeriodicCheck() {
      if (this._timer) return;
      this._timer = setInterval(() => {
        if (!this.enabled) return;
        this.fullCheck();
      }, this._checkInterval);
    }

    _stopPeriodicCheck() {
      if (this._timer) {
        clearInterval(this._timer);
        this._timer = null;
      }
    }

    handleMutations(mutations) {
      const debounced = Utils.debounce(() => {
        this.validateAll();
      }, 100);
      debounced();
    }

    fullCheck() {
      if (!this.enabled || this._isSyncing) return;
      
      this._lastCheck = Date.now();
      const results = {
        cardErrors: [],
        domStoreMismatch: [],
        relationshipErrors: [],
        securityIssues: [],
        timestamp: Date.now()
      };

      const cards = this.store.getAllCards();
      cards.forEach(card => {
        const validation = this.typeRegistry.validate(card);
        if (!validation.valid) {
          results.cardErrors.push({ cardId: card.id, errors: validation.errors });
        }
        if (validation.warnings && validation.warnings.length > 0) {
          results.securityIssues.push({ cardId: card.id, warnings: validation.warnings });
        }
      });

      const domSyncResult = this._checkDomStoreSync();
      results.domStoreMismatch = domSyncResult.mismatches;

      const relResult = this._checkRelationshipIntegrity();
      results.relationshipErrors = relResult.errors;

      const securityResult = this._checkSecurityIssues();
      results.securityIssues = [...results.securityIssues, ...securityResult.issues];

      const hasIssues = results.cardErrors.length > 0 || 
                        results.domStoreMismatch.length > 0 || 
                        results.relationshipErrors.length > 0 ||
                        results.securityIssues.length > 0;

      if (hasIssues) {
        eventBus.emit('fullCheckFailed', results);
        FeedbackSystem.warn(
          '全量检查发现问题',
          `卡片错误: ${results.cardErrors.length}，DOM/Store 不一致: ${results.domStoreMismatch.length}，关系错误: ${results.relationshipErrors.length}，安全问题: ${results.securityIssues.length}`
        );
      }

      return results;
    }

    _checkSecurityIssues() {
      const issues = [];

      if (!this.container) return { issues };

      const allElements = this.container.querySelectorAll('*');
      allElements.forEach(el => {
        for (const attr of el.attributes) {
          const attrName = attr.name.toLowerCase();
          if (attrName.startsWith('on')) {
            issues.push({
              type: 'inline-event-handler',
              severity: 'high',
              element: el.tagName,
              attribute: attrName,
              message: `检测到内联事件处理器 "${attrName}"，存在 XSS 风险`
            });
          }
        }

        if (el.hasAttribute('style')) {
          const styleValue = el.getAttribute('style');
          const safeStyle = Security.sanitizeStyle(styleValue);
          if (safeStyle !== styleValue) {
            issues.push({
              type: 'dangerous-style',
              severity: 'high',
              element: el.tagName,
              cardId: el.closest('[data-card-id]')?.dataset?.cardId,
              message: '检测到危险的 style 属性内容'
            });
          }
        }

        if (el.tagName === 'A' || el.tagName === 'AREA') {
          const href = el.getAttribute('href');
          if (href && !Security.isSafeUrl(href)) {
            issues.push({
              type: 'dangerous-url',
              severity: 'high',
              element: el.tagName,
              cardId: el.closest('[data-card-id]')?.dataset?.cardId,
              attribute: 'href',
              value: href,
              message: '检测到危险的 URL 协议'
            });
          }
        }

        if (el.tagName === 'IFRAME' || el.tagName === 'SCRIPT') {
          issues.push({
            type: 'dangerous-element',
            severity: 'high',
            element: el.tagName,
            cardId: el.closest('[data-card-id]')?.dataset?.cardId,
            message: `检测到危险元素 <${el.tagName.toLowerCase()}>`
          });
        }
      });

      return { issues };
    }

    _checkDomStoreSync() {
      const mismatches = [];
      const cardEls = this.container.querySelectorAll('[data-card-id]');
      const domCardIds = new Set();
      const domCards = new Map();

      cardEls.forEach(el => {
        const cardId = el.dataset.cardId;
        domCardIds.add(cardId);
        domCards.set(cardId, {
          type: el.dataset.cardType,
          title: el.querySelector('.card-title')?.textContent || ''
        });
      });

      const storeCards = this.store.getAllCards();
      storeCards.forEach(card => {
        if (!domCardIds.has(card.id)) {
          mismatches.push({
            type: 'store_only',
            cardId: card.id,
            card: card
          });
        } else {
          const domCard = domCards.get(card.id);
          if (domCard && domCard.type !== card.type) {
            mismatches.push({
              type: 'type_mismatch',
              cardId: card.id,
              storeType: card.type,
              domType: domCard.type
            });
          }
        }
      });

      domCardIds.forEach(cardId => {
        if (!this.store.getCard(cardId)) {
          mismatches.push({
            type: 'dom_only',
            cardId: cardId,
            domCard: domCards.get(cardId)
          });
        }
      });

      return { mismatches };
    }

    _checkRelationshipIntegrity() {
      const errors = [];
      const relationships = this.store.getAllRelationships();
      const cardIds = new Set(this.store.getAllCards().map(c => c.id));

      relationships.forEach(rel => {
        if (!cardIds.has(rel.sourceId)) {
          errors.push({
            type: 'missing_source',
            relId: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId
          });
        }
        if (!cardIds.has(rel.targetId)) {
          errors.push({
            type: 'missing_target',
            relId: rel.id,
            sourceId: rel.sourceId,
            targetId: rel.targetId
          });
        }
      });

      return { errors };
    }

    validateAll() {
      if (!this.enabled || this._isSyncing) return;
      
      const errors = [];
      const cards = this.store.getAllCards();
      
      cards.forEach(card => {
        const validation = this.typeRegistry.validate(card);
        if (!validation.valid) {
          errors.push({ cardId: card.id, errors: validation.errors });
        }
      });

      if (errors.length > 0) {
        errors.forEach(({ cardId, errors: cardErrors }) => {
          eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, { cardId, errors: cardErrors });
        });
      }
    }

    syncFromDOM() {
      if (this._isSyncing) return;
      this._isSyncing = true;
      
      const cardEls = this.container.querySelectorAll('[data-card-id]');
      const domCardIds = new Set();

      cardEls.forEach(el => {
        const cardId = el.dataset.cardId;
        domCardIds.add(cardId);
        
        const storeCard = this.store.getCard(cardId);
        if (!storeCard) {
          const type = el.dataset.cardType || 'text';
          const newCard = {
            id: cardId,
            type,
            props: {
              title: el.querySelector('.card-title')?.textContent || ''
            },
            position: { x: 0, y: 0 },
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          this.store.addCard(newCard);
          FeedbackSystem.fix('从 DOM 中恢复卡片', `cardId: ${cardId}`);
        }
      });

      const storeCards = this.store.getAllCards();
      storeCards.forEach(card => {
        if (!domCardIds.has(card.id)) {
          FeedbackSystem.warn(
            `Store 中的卡片 ${card.id} 在 DOM 中不存在，已重新渲染`,
            '检查是否有外部代码移除了卡片元素'
          );
        }
      });

      this._isSyncing = false;
      eventBus.emit(EVENT_TYPES.DOM_SYNCHRONIZED, { cardCount: domCardIds.size });
    }

    pause() {
      this._isSyncing = true;
    }

    resume() {
      this._isSyncing = false;
    }

    getLastCheckTime() {
      return this._lastCheck;
    }
  }

  class Renderer {
    constructor(container, typeRegistry, store) {
      this.container = container;
      this.typeRegistry = typeRegistry;
      this.store = store;
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
          eventBus.emit('cardDoubleClick', { card, event: e });
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
      eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
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
        eventBus.emit(EVENT_TYPES.CARD_UPDATED, { card });
      };
      this._trackEventListener(card.id, el.querySelector('[data-action="retry"]'), 'click', retryHandler);
      
      const deleteHandler = () => {
        if (confirm('确定删除这张卡片吗？')) {
          card.store && card.store.removeCard(card.id);
        }
      };
      this._trackEventListener(card.id, el.querySelector('[data-action="delete"]'), 'click', deleteHandler);

      return el;
    }

    forceFullRender(cards) {
      this._lastCardIds = [];
      this.container.innerHTML = '';
      this._eventListeners.clear();
      this.renderCards(cards);
    }
  }

  class LayoutEngine {
    constructor(container, store, renderer) {
      this.container = container;
      this.store = store;
      this.renderer = renderer;
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
      eventBus.emit(EVENT_TYPES.LAYOUT_CHANGED, { mode });
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

  class VirtualScroller {
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
      const visibleCards = cards.slice(start, end);
      this.renderer.renderCards(visibleCards);
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
    }
  }

  const defaultCardTypes = [
    {
      type: 'base',
      label: '基础卡',
      icon: '📋',
      description: '基础卡片类型',
      abstract: true,
      propsSchema: [
        { name: 'title', type: 'string', required: true, label: '标题', defaultValue: '未命名卡片' }
      ],
      renderTemplate: `
        <div class="card card-base">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body"></div>
        </div>
      `,
      defaultStyle: {}
    },
    {
      type: 'text',
      label: '文本卡',
      icon: '📝',
      description: '用于展示文本内容',
      extends: 'base',
      propsSchema: [
        { name: 'content', type: 'string', required: false, label: '内容' }
      ],
      renderTemplate: `
        <div class="card card-text">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body card-text-content">{{content}}</div>
        </div>
      `,
      defaultStyle: {}
    },
    {
      type: 'task',
      label: '任务卡',
      icon: '✅',
      description: '用于管理待办任务',
      extends: 'base',
      propsSchema: [
        { name: 'dueDate', type: 'date', required: false, label: '截止日期' },
        { name: 'priority', type: 'string', required: false, label: '优先级', allowedValues: ['high', 'medium', 'low'], defaultValue: 'medium' }
      ],
      renderTemplate: `
        <div class="card card-task card-priority-{{priority}}">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
            <span class="card-priority-badge">{{priority}}</span>
          </div>
          <div class="card-body">
            <p class="card-due-date" style="display: {{dueDate ? 'block' : 'none'}};">截止: {{dueDate}}</p>
          </div>
          <div class="card-footer">
            <button class="btn btn-complete" data-action="complete">完成</button>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'complete',
          label: '完成',
          handler: (card) => {
            card.status = card.status === 'completed' ? 'active' : 'completed';
            if (card.store) {
              card.store.updateCard(card);
            } else {
              const store = CardFrame._globalStore;
              if (store) store.updateCard(card);
            }
          }
        }
      ],
      defaultStyle: {}
    },
    {
      type: 'image',
      label: '图片卡',
      icon: '🖼️',
      description: '用于展示图片',
      extends: 'base',
      propsSchema: [
        { name: 'src', type: 'string', required: true, label: '图片地址' },
        { name: 'alt', type: 'string', required: false, label: '替代文本', defaultValue: '图片' },
        { name: 'caption', type: 'string', required: false, label: '说明文字' }
      ],
      renderTemplate: `
        <div class="card card-image">
          <div class="card-image-container">
            <img src="{{src}}" alt="{{alt}}" class="card-image-img">
          </div>
          <div class="card-header">
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body">
            <p class="card-caption">{{caption}}</p>
          </div>
        </div>
      `,
      defaultStyle: {}
    },
    {
      type: 'list',
      label: '列表卡',
      icon: '📋',
      description: '用于展示列表内容',
      extends: 'base',
      propsSchema: [
        { name: 'items', type: 'array', required: false, label: '列表项', defaultValue: '' }
      ],
      renderTemplate: `
        <div class="card card-list">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body">
            <ul class="card-list-items">
              <li class="card-list-item">列表项 1</li>
            </ul>
          </div>
        </div>
      `,
      actions: [
        {
          name: 'addItem',
          label: '添加项',
          handler: (card, store) => {
            const item = prompt('输入新列表项：');
            if (item && store) {
              const items = Array.isArray(card.items) ? [...card.items] : [];
              items.push(item);
              store.updateCard(card.id, { items });
            }
          }
        }
      ],
      defaultStyle: {}
    },
    {
      type: 'progress',
      label: '进度卡',
      icon: '📊',
      description: '用于展示进度',
      extends: 'base',
      propsSchema: [
        { name: 'value', type: 'number', required: false, label: '当前值', defaultValue: 0 },
        { name: 'max', type: 'number', required: false, label: '最大值', defaultValue: 100 },
        { name: 'unit', type: 'string', required: false, label: '单位', defaultValue: '%' }
      ],
      renderTemplate: `
        <div class="card card-progress">
          <div class="card-header">
            <span class="card-icon">{{icon}}</span>
            <h3 class="card-title">{{title}}</h3>
          </div>
          <div class="card-body">
            <div class="progress-bar">
              <div class="progress-bar-fill" style="width: {{value}}%;"></div>
            </div>
            <p class="progress-text">{{value}} / {{max}} {{unit}}</p>
          </div>
        </div>
      `,
      defaultStyle: {}
    }
  ];

  class CardElement extends HTMLElement {
    constructor() {
      super();
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
            eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, { 
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
            eventBus.emit(EVENT_TYPES.CARD_VALIDATION_ERROR, { 
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

  class CardFrameElement extends HTMLElement {
    connectedCallback() {
      if (!this._initialized) {
        this._initialized = true;
        this.classList.add('card-frame');
        
        const localStore = new Store();
        const localRenderer = new Renderer(this, globalTypeRegistry, localStore);
        const localAutoFixer = new AutoFixer(globalTypeRegistry, localStore);
        const localValidator = new RealTimeValidator(this, globalTypeRegistry, localStore, localAutoFixer);
        
        this._store = localStore;
        this._renderer = localRenderer;
        this._autoFixer = localAutoFixer;
        this._validator = localValidator;
        
        const frame = {
          store: localStore,
          typeRegistry: globalTypeRegistry,
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
          
          const validation = globalTypeRegistry.validate(card);
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

  class CardFrame {
    constructor(container, options = {}) {
      if (typeof container === 'string') {
        const el = document.querySelector(container);
        if (!el) {
          throw new Error(`找不到容器元素: ${container}`);
        }
        container = el;
      }
      
      if (container.__cardFrame) {
        return container.__cardFrame;
      }
      
      this.container = container;
      this.container.classList.add('card-frame');
      this.container.__cardFrame = this;
      this._options = options;
      
      this.store = new Store();
      this.typeRegistry = new TypeRegistry();
      this.renderer = new Renderer(container, this.typeRegistry, this.store);
      this.layoutEngine = new LayoutEngine(container, this.store, this.renderer);
      this.autoFixer = new AutoFixer(this.typeRegistry, this.store, container);
      this.realTimeValidator = new RealTimeValidator(container, this.typeRegistry, this.store, this.autoFixer);
      this.pluginManager = new PluginManager(this);
      this.circuitBreaker = new CircuitBreaker(options.circuitBreaker || {});
      this.actionLogger = new ActionLogger(options.actionLogger || {});
      this.globalErrorHandler = new GlobalErrorHandler(eventBus);
      this.perfPanel = new PerfPanel();
      this.cardObjectPool = new CardObjectPool(options.cardPool || {});
      this.themeManager = new ThemeManager(container);
      this.i18n = new I18nManager();
      this.relationshipEngine = new RelationshipEngine(container, this.store);
      this.virtualScroller = new VirtualScroller(container, this.store, this.renderer, {
        overscan: options.overscan || DEFAULT_CONFIG.VIRTUAL_SCROLL_OVERSCAN
      });
      this.eventBus = eventBus;

      this.autoFixer._getValidator = () => this.realTimeValidator;

      defaultCardTypes
        .forEach(type => this.typeRegistry.register(type));

      this.store.subscribe(Utils.debounce(() => {
        this.realTimeValidator.pause();
        if (this.virtualScroller && this.virtualScroller.isEnabled()) {
          this.virtualScroller.refresh();
        } else {
          this.renderer.renderCards(this.store.getAllCards());
        }
        if (this.layoutEngine.mode === 'canvas') {
          this.layoutEngine.syncPositions();
        }
        this.realTimeValidator.resume();
      }, 16));

      if (options.virtualScroll) {
        this.virtualScroller.enable();
      }

      if (options.plugins) {
        options.plugins.forEach(plugin => this.installPlugin(plugin));
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this._initFromDOM());
      } else {
        this._initFromDOM();
      }

      if (options.autoValidate !== false) {
        this.realTimeValidator.start();
      }

      CardFrame._globalStore = this.store;
    }

    _initFromDOM() {
      const cardEls = this.container.querySelectorAll('cf-card');
      cardEls.forEach(el => {
        if (!el.dataset.cardId && el._waitingForFrame) {
          el._waitingForFrame = false;
          el._initCard();
        }
      });
    }

    /**
     * 创建一张新卡片
     * @param {string} type - 卡片类型，必须是已注册的非抽象类型
     * @param {Object} props - 卡片属性对象
     * @returns {Object} 创建的卡片对象
     * @example
     * // 创建一张文本卡片
     * const card = frame.createCard('text', { title: '我的卡片', content: 'Hello World' });
     * @example
     * // 创建一张任务卡片
     * const task = frame.createCard('task', { title: '完成报告', priority: 'high', dueDate: '2024-12-31' });
     * @fires cardAdded
     * @fires cardAutoFixed - 如果验证失败且自动修复成功
     */
    createCard(type, props) {
      return this.circuitBreaker.execute(() => {
        const cardType = this.typeRegistry.get(type);
        if (cardType && cardType.abstract) {
          throw new Error(`不能创建抽象类型 "${type}" 的卡片`);
        }

        const card = {
          id: Utils.generateId('card'),
          type,
          props: { ...props },
          position: { x: 0, y: 0 },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const validation = this.typeRegistry.validate(card);
        if (!validation.valid) {
          validation.errors.forEach(err => {
            FeedbackSystem.warn(err.message);
          });
          this.autoFixer.fixCard(card, validation);
        }

        this.store.addCard(card);
        this.actionLogger.record('addCard', { card: { ...card } });
        return card;
      }, null);
    }

    /**
     * 更新卡片信息
     * @param {Object} card - 完整的卡片对象（必须包含 id）
     * @returns {Object|null} 更新后的卡片对象，卡片不存在则返回 null
     * @example
     * // 更新卡片标题
     * const card = frame.getCard('card_xxx');
     * card.props.title = '新标题';
     * frame.updateCard(card);
     * @fires cardUpdated
     */
    updateCard(card) {
      return this.circuitBreaker.execute(() => {
        const previousState = this.store.getCard(card.id);
        const result = this.store.updateCard(card);
        if (previousState) {
          this.actionLogger.record('updateCard', {
            cardId: card.id,
            previousState: { ...previousState.props },
            newState: { ...card.props }
          });
        }
        return result;
      }, card.id);
    }

    /**
     * 删除指定卡片
     * @param {string} id - 卡片 ID
     * @returns {boolean} 删除成功返回 true，卡片不存在返回 false
     * @example
     * // 删除一张卡片
     * const success = frame.removeCard('card_xxx');
     * console.log(success ? '删除成功' : '卡片不存在');
     * @fires cardRemoved
     */
    removeCard(id) {
      return this.circuitBreaker.execute(() => {
        const card = this.store.getCard(id);
        const result = this.store.removeCard(id);
        if (card && result) {
          this.actionLogger.record('removeCard', { card: { ...card } });
        }
        return result;
      }, id);
    }

    /**
     * 获取指定 ID 的卡片
     * @param {string} id - 卡片 ID
     * @returns {Object|undefined} 卡片对象，不存在则返回 undefined
     * @example
     * // 获取卡片
     * const card = frame.getCard('card_xxx');
     * if (card) {
     *   console.log(card.props.title);
     * }
     */
    getCard(id) {
      return this.store.getCard(id);
    }

    /**
     * 获取所有卡片
     * @returns {Array<Object>} 卡片对象数组
     * @example
     * // 获取所有卡片
     * const cards = frame.getAllCards();
     * console.log(`共有 ${cards.length} 张卡片`);
     */
    getAllCards() {
      return this.store.getAllCards();
    }

    /**
     * 根据类型获取卡片
     * @param {string} type - 卡片类型
     * @returns {Array<Object>} 指定类型的卡片对象数组
     * @example
     * // 获取所有任务卡片
     * const tasks = frame.getCardsByType('task');
     * console.log(`共有 ${tasks.length} 个任务`);
     */
    getCardsByType(type) {
      return this.store.getCardsByType(type);
    }

    /**
     * 批量创建卡片
     * @param {Array<Object>} cards - 卡片数据数组，每项包含 type 和 props
     * @returns {Object} 结果对象，包含 success（成功的卡片数组）和 errors（失败的错误数组）
     * @example
     * // 批量创建卡片
     * const result = frame.batchCreateCards([
     *   { type: 'text', props: { title: '卡片1' } },
     *   { type: 'task', props: { title: '任务1', priority: 'high' } }
     * ]);
     * console.log(`成功创建 ${result.success.length} 张，失败 ${result.errors.length} 张`);
     * @fires cardAdded - 每张成功创建的卡片都会触发
     * @fires frameworkError - 每张创建失败的卡片都会触发
     */
    batchCreateCards(cards) {
      const results = [];
      const errors = [];
      
      cards.forEach((cardData, index) => {
        try {
          const card = this.createCard(cardData.type, cardData.props || {});
          if (cardData.id) card.id = cardData.id;
          if (cardData.position) card.position = cardData.position;
          if (cardData.status) card.status = cardData.status;
          if (cardData.style) card.style = cardData.style;
          results.push(card);
        } catch (e) {
          errors.push({ index, error: e.message, cardData });
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'batch_error',
            message: `批量创建卡片失败 (索引 ${index}): ${e.message}`,
            error: e,
            context: { operation: 'batchCreateCards', index, cardData },
            timestamp: Date.now()
          });
        }
      });

      return { success: results, errors };
    }

    /**
     * 批量更新卡片
     * @param {Array<Object>} updates - 更新数据数组，每项包含 id 及要更新的字段
     * @returns {Object} 结果对象，包含 success（成功的卡片数组）和 errors（失败的错误数组）
     * @example
     * // 批量更新卡片
     * const result = frame.batchUpdateCards([
     *   { id: 'card_1', props: { title: '新标题1' } },
     *   { id: 'card_2', props: { title: '新标题2' } }
     * ]);
     * console.log(`成功更新 ${result.success.length} 张，失败 ${result.errors.length} 张`);
     * @fires cardUpdated - 每张成功更新的卡片都会触发
     * @fires frameworkError - 每张更新失败的卡片都会触发
     */
    batchUpdateCards(updates) {
      const results = [];
      const errors = [];

      updates.forEach((update, index) => {
        try {
          const card = this.getCard(update.id);
          if (!card) {
            errors.push({ index, error: `卡片 ${update.id} 不存在`, update });
            return;
          }
          const updated = { ...card, ...update, id: update.id };
          const result = this.updateCard(updated);
          results.push(result);
        } catch (e) {
          errors.push({ index, error: e.message, update });
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'batch_error',
            message: `批量更新卡片失败 (索引 ${index}): ${e.message}`,
            error: e,
            context: { operation: 'batchUpdateCards', index, update },
            timestamp: Date.now()
          });
        }
      });

      return { success: results, errors };
    }

    /**
     * 批量删除卡片
     * @param {Array<string>} ids - 要删除的卡片 ID 数组
     * @returns {Object} 结果对象，包含 success（成功删除的 ID 数组）和 errors（失败的错误数组）
     * @example
     * // 批量删除卡片
     * const result = frame.batchRemoveCards(['card_1', 'card_2', 'card_3']);
     * console.log(`成功删除 ${result.success.length} 张，失败 ${result.errors.length} 张`);
     * @fires cardRemoved - 每张成功删除的卡片都会触发
     * @fires frameworkError - 每张删除失败的卡片都会触发
     */
    batchRemoveCards(ids) {
      const results = [];
      const errors = [];

      ids.forEach((id, index) => {
        try {
          const success = this.removeCard(id);
          if (success) {
            results.push(id);
          } else {
            errors.push({ index, error: `卡片 ${id} 删除失败`, id });
          }
        } catch (e) {
          errors.push({ index, error: e.message, id });
          eventBus.emit(EVENT_TYPES.FRAMEWORK_ERROR, {
            type: 'batch_error',
            message: `批量删除卡片失败 (索引 ${index}): ${e.message}`,
            error: e,
            context: { operation: 'batchRemoveCards', index, id },
            timestamp: Date.now()
          });
        }
      });

      return { success: results, errors };
    }

    /**
     * 撤销最近一次操作
     * @returns {boolean} 撤销成功返回 true，无操作可撤销返回 false
     * @example
     * if (frame.actionLogger.canUndo()) {
     *   frame.undo();
     * }
     */
    undo() {
      return this.actionLogger.undo(this.store);
    }

    /**
     * 重做最近一次撤销的操作
     * @returns {boolean} 重做成功返回 true，无操作可重做返回 false
     * @example
     * if (frame.actionLogger.canRedo()) {
     *   frame.redo();
     * }
     */
    redo() {
      return this.actionLogger.redo(this.store);
    }

    /**
     * 回滚到指定时间点
     * @param {number} timestamp - 时间戳
     * @returns {boolean} 回滚成功返回 true
     * @example
     * // 回滚到 5 分钟前
     * const t = Date.now() - 5 * 60 * 1000;
     * frame.rollback(t);
     */
    rollback(timestamp) {
      return this.actionLogger.rollback(timestamp, this.store);
    }

    /**
     * 获取操作历史
     * @returns {Array} 历史记录数组
     */
    getActionHistory() {
      return this.actionLogger.getHistory();
    }

    /**
     * 清空所有历史记录
     */
    clearActionHistory() {
      this.actionLogger.clear();
    }

    /**
     * 创建卡片之间的关系
     * @param {string} sourceId - 源卡片 ID
     * @param {string} targetId - 目标卡片 ID
     * @param {string} [type='reference'] - 关系类型：reference/parent/child/dependency/related
     * @param {Object} [data={}] - 附加的关系数据
     * @returns {Object} 创建的关系对象
     * @example
     * // 创建引用关系
     * const rel = frame.createRelationship('card_1', 'card_2', 'reference');
     * @example
     * // 创建父子关系
     * const rel = frame.createRelationship('parent_id', 'child_id', 'parent');
     * @fires relationshipAdded
     */
    createRelationship(sourceId, targetId, type = 'reference', data = {}) {
      const rel = this.store.addRelationship({
        sourceId,
        targetId,
        type,
        data
      });
      if (rel) {
        this.actionLogger.record('addRelationship', { relationship: { ...rel } });
      }
      return rel;
    }

    /**
     * 删除指定关系
     * @param {string} id - 关系 ID
     * @returns {boolean} 删除成功返回 true，关系不存在返回 false
     * @example
     * // 删除一条关系
     * const success = frame.removeRelationship('rel_xxx');
     * @fires relationshipRemoved
     */
    removeRelationship(id) {
      const rel = this.store.getRelationship(id);
      const result = this.store.removeRelationship(id);
      if (rel && result) {
        this.actionLogger.record('removeRelationship', { relationship: { ...rel } });
      }
      return result;
    }

    /**
     * 获取指定 ID 的关系
     * @param {string} id - 关系 ID
     * @returns {Object|undefined} 关系对象，不存在则返回 undefined
     * @example
     * // 获取关系
     * const rel = frame.getRelationship('rel_xxx');
     * if (rel) {
     *   console.log(rel.type);
     * }
     */
    getRelationship(id) {
      return this.store.getRelationship(id);
    }

    /**
     * 获取所有关系
     * @returns {Array<Object>} 关系对象数组
     * @example
     * // 获取所有关系
     * const relationships = frame.getAllRelationships();
     * console.log(`共有 ${relationships.length} 条关系`);
     */
    getAllRelationships() {
      return this.store.getAllRelationships();
    }

    getRelationshipsByCard(cardId) {
      return this.store.getRelationshipsByCard(cardId);
    }

    getRelationshipsByType(type) {
      return this.store.getRelationshipsByType(type);
    }

    /**
     * 设置布局模式
     * @param {string} mode - 布局模式：'stream'（流布局）或 'canvas'（画布模式）
     * @example
     * // 切换到画布模式
     * frame.setLayoutMode('canvas');
     * @example
     * // 切换到流布局
     * frame.setLayoutMode('stream');
     * @fires layoutChanged
     */
    setLayoutMode(mode) {
      this.layoutEngine.setMode(mode);
    }

    /**
     * 获取当前布局模式
     * @returns {string} 当前布局模式：'stream' 或 'canvas'
     * @example
     * const mode = frame.getLayoutMode();
     * console.log(`当前布局: ${mode}`);
     */
    getLayoutMode() {
      return this.layoutEngine.getMode();
    }

    /**
     * 安装插件
     * @param {Object} pluginDef - 插件定义对象
     * @param {string} pluginDef.name - 插件名称（唯一标识）
     * @param {string} [pluginDef.version] - 插件版本
     * @param {Function} [pluginDef.install] - 安装时的回调函数
     * @param {Function} [pluginDef.uninstall] - 卸载时的回调函数
     * @param {Function} [pluginDef.enable] - 启用时的回调函数
     * @param {Function} [pluginDef.disable] - 禁用时的回调函数
     * @param {Array} [pluginDef.cardTypes] - 插件提供的卡片类型定义
     * @returns {boolean} 安装成功返回 true
     * @example
     * // 安装一个简单插件
     * frame.installPlugin({
     *   name: 'my-plugin',
     *   version: '1.0.0',
     *   install: (frame) => {
     *     console.log('插件已安装');
     *   }
     * });
     * @fires pluginInstalled
     * @fires frameworkError - 插件安装失败时触发
     */
    installPlugin(pluginDef) {
      return this.pluginManager.install(pluginDef);
    }

    /**
     * 卸载插件
     * @param {string} pluginName - 插件名称
     * @returns {boolean} 卸载成功返回 true，插件不存在返回 false
     * @example
     * // 卸载插件
     * frame.uninstallPlugin('my-plugin');
     * @fires pluginUninstalled
     * @fires frameworkError - 插件卸载钩子执行失败时触发
     */
    uninstallPlugin(pluginName) {
      return this.pluginManager.uninstall(pluginName);
    }

    /**
     * 启用插件
     * @param {string} pluginName - 插件名称
     * @returns {boolean} 启用成功返回 true，插件不存在或启用失败返回 false
     * @example
     * // 启用插件
     * frame.enablePlugin('my-plugin');
     * @fires pluginEnabled
     * @fires frameworkError - 插件启用失败时触发
     */
    enablePlugin(pluginName) {
      return this.pluginManager.enable(pluginName);
    }

    /**
     * 禁用插件
     * @param {string} pluginName - 插件名称
     * @returns {boolean} 禁用成功返回 true，插件不存在返回 false
     * @example
     * // 禁用插件
     * frame.disablePlugin('my-plugin');
     * @fires pluginDisabled
     * @fires frameworkError - 插件禁用失败时触发
     */
    disablePlugin(pluginName) {
      return this.pluginManager.disable(pluginName);
    }

    /**
     * 注册事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 事件处理函数
     * @example
     * // 监听卡片添加事件
     * frame.on('cardAdded', (event) => {
     *   console.log('新卡片已添加:', event.detail.card);
     * });
     * @example
     * // 监听框架错误事件
     * frame.on('frameworkError', (event) => {
     *   console.error('框架错误:', event.detail.message);
     * });
     */
    on(eventName, listener) {
      eventBus.on(eventName, listener);
    }

    /**
     * 移除事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 要移除的事件处理函数
     * @example
     * // 移除事件监听器
     * const handler = (e) => console.log(e);
     * frame.on('cardAdded', handler);
     * frame.off('cardAdded', handler);
     */
    off(eventName, listener) {
      eventBus.off(eventName, listener);
    }

    /**
     * 注册一次性事件监听器（触发一次后自动移除）
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 事件处理函数
     * @example
     * // 只监听一次卡片添加事件
     * frame.once('cardAdded', (event) => {
     *   console.log('第一张卡片已添加');
     * });
     */
    once(eventName, listener) {
      eventBus.once(eventName, listener);
    }

    /**
     * 导出数据（返回对象格式）
     * @returns {Object} 导出的数据对象，包含 cards、relationships、layoutMode 等
     * @example
     * // 导出数据
     * const data = frame.exportData();
     * console.log(`导出了 ${data.metadata.cardCount} 张卡片`);
     */
    exportData() {
      return {
        version: '1.0',
        exportedAt: Date.now(),
        cards: this.store.getAllCards(),
        relationships: this.store.getAllRelationships(),
        layoutMode: this.layoutEngine.mode,
        metadata: {
          cardCount: this.store.getAllCards().length,
          relationshipCount: this.store.getAllRelationships().length
        }
      };
    }

    /**
     * 导出数据（返回 JSON 字符串）
     * @returns {string} JSON 格式的字符串
     * @example
     * // 导出为 JSON 字符串
     * const json = frame.exportJSON();
     * // 下载到文件
     * const blob = new Blob([json], { type: 'application/json' });
     */
    exportJSON() {
      return JSON.stringify(this.exportData(), null, 2);
    }

    /**
     * 导入数据
     * @param {Object|string} data - 要导入的数据（对象或 JSON 字符串）
     * @param {Object} [options] - 导入选项
     * @param {string} [options.mode='merge'] - 导入模式：'merge'（合并）或 'replace'（替换）
     * @param {boolean} [options.clearBeforeImport=false] - 导入前是否清空现有数据
     * @param {boolean} [options.preserveLayout=false] - 是否保留当前布局模式
     * @returns {Object} 导入结果统计
     * @example
     * // 合并导入数据
     * const result = frame.importData(data, { mode: 'merge' });
     * console.log(`导入了 ${result.importedCards} 张卡片`);
     * @example
     * // 替换导入数据
     * frame.importData(jsonString, { mode: 'replace' });
     * @fires cardAdded - 新增卡片时触发
     * @fires cardUpdated - 更新卡片时触发
     * @fires relationshipAdded - 新增关系时触发
     * @fires relationshipRemoved - 删除关系时触发
     * @fires layoutChanged - 布局模式改变时触发
     */
    importData(data, options = {}) {
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      const { mode = 'merge', clearBeforeImport = false } = options;

      if (clearBeforeImport) {
        this.store.cards.clear();
        this.store.relationships.clear();
      }

      if (mode === 'replace') {
        this.store.cards.clear();
        this.store.relationships.clear();
      }

      let importedCards = 0;
      let importedRelationships = 0;

      if (data.cards) {
        data.cards.forEach(cardData => {
          if (mode === 'merge' && this.store.getCard(cardData.id)) {
            this.store.updateCard(cardData);
          } else {
            this.store.cards.set(cardData.id, cardData);
          }
          importedCards++;
        });
      }

      if (data.relationships) {
        data.relationships.forEach(relData => {
          if (mode === 'merge' && this.store.getRelationship(relData.id)) {
            this.store.updateRelationship(relData);
          } else {
            this.store.relationships.set(relData.id, relData);
          }
          importedRelationships++;
        });
      }

      if (data.layoutMode && !options.preserveLayout) {
        this.layoutEngine.setMode(data.layoutMode);
      }

      this.store.notify();

      return {
        importedCards,
        importedRelationships,
        mode,
        totalCards: this.store.getAllCards().length,
        totalRelationships: this.store.getAllRelationships().length
      };
    }

    /**
     * 获取框架统计信息
     * @returns {Object} 统计对象，包含卡片、关系、插件、布局、性能等统计
     * @example
     * // 获取统计信息
     * const stats = frame.getStats();
     * console.log(`卡片总数: ${stats.cards.total}`);
     * console.log(`插件数量: ${stats.plugins.total}`);
     * console.log(`平均渲染时间: ${stats.performance.avgRenderTime}ms`);
     */
    getStats() {
      return {
        cards: {
          total: this.store.getAllCards().length,
          byType: this._getCardTypeStats()
        },
        relationships: {
          total: this.store.getAllRelationships().length
        },
        plugins: {
          total: this.pluginManager.getAll().length,
          enabled: this.pluginManager.getAll().filter(p => p.enabled).length
        },
        layout: {
          mode: this.layoutEngine.mode,
          zoom: this.layoutEngine.zoom
        },
        circuitBreaker: this.circuitBreaker.getStats(),
        autoFixer: this.autoFixer.getStats(),
        performance: Perf.getStats()
      };
    }

    getPerfStats() {
      return Perf.getStats();
    }

    /**
     * 启用性能监控面板
     */
    enablePerfPanel() {
      this.perfPanel.enable(this.container);
    }

    /**
     * 禁用性能监控面板
     */
    disablePerfPanel() {
      this.perfPanel.disable();
    }

    /**
     * 启用全局错误捕获
     */
    enableGlobalErrorHandler() {
      this.globalErrorHandler.enable();
    }

    /**
     * 禁用全局错误捕获
     */
    disableGlobalErrorHandler() {
      this.globalErrorHandler.disable();
    }

    /**
     * 获取全局错误统计
     */
    getGlobalErrorStats() {
      return this.globalErrorHandler.getErrorStats();
    }

    enableVirtualScroll(options = {}) {
      if (this.virtualScroller) {
        this.virtualScroller.enable(options);
      }
    }

    disableVirtualScroll() {
      if (this.virtualScroller) {
        this.virtualScroller.disable();
        this.renderer.forceFullRender(this.store.getAllCards());
      }
    }

    isVirtualScrollEnabled() {
      return this.virtualScroller ? this.virtualScroller.isEnabled() : false;
    }

    _getCardTypeStats() {
      const stats = {};
      this.store.getAllCards().forEach(card => {
        stats[card.type] = (stats[card.type] || 0) + 1;
      });
      return stats;
    }

    toJSON() {
      return this.store.toJSON();
    }

    static fromJSON(data) {
      const container = document.createElement('div');
      const frame = new CardFrame(container);
      const store = Store.fromJSON(data);
      frame.store = store;
      store.subscribe(Utils.debounce(() => {
        frame.renderer.renderCards(store.getAllCards());
      }, 16));
      return frame;
    }

    static getPerfStats() {
      return Perf.getStats();
    }

    static from(selector) {
      const container = document.querySelector(selector);
      if (!container) {
        throw new Error(`找不到容器元素: ${selector}`);
      }
      return new CardFrame(container);
    }
  }

  CardFrame.Utils = Utils;
  CardFrame.Store = Store;
  CardFrame.TypeRegistry = TypeRegistry;
  CardFrame.Renderer = Renderer;
  CardFrame.LayoutEngine = LayoutEngine;
  CardFrame.EventBus = eventBus;
  CardFrame.AutoFixer = AutoFixer;
  CardFrame.RealTimeValidator = RealTimeValidator;
  CardFrame.FeedbackSystem = FeedbackSystem;
  CardFrame.EVENT_TYPES = EVENT_TYPES;
  CardFrame.DEFAULT_CONFIG = DEFAULT_CONFIG;
  CardFrame.CARD_STATUS = CARD_STATUS;
  CardFrame.RELATIONSHIP_TYPES = RELATIONSHIP_TYPES;
  CardFrame.PluginManager = PluginManager;
  CardFrame.ActionLogger = ActionLogger;
  CardFrame.CircuitBreaker = CircuitBreaker;
  CardFrame.ThemeManager = ThemeManager;
  CardFrame.I18nManager = I18nManager;
  CardFrame.RelationshipEngine = RelationshipEngine;
  CardFrame.VirtualScroller = VirtualScroller;
  CardFrame.Security = Security;
  CardFrame.Perf = Perf;
  CardFrame.PerfPanel = PerfPanel;
  CardFrame.GlobalErrorHandler = GlobalErrorHandler;
  CardFrame.CardObjectPool = CardObjectPool;
  CardFrame.LayoutCache = LayoutCache;
  CardFrame.QueryIndex = QueryIndex;
  CardFrame.ShadowCardRegistry = ShadowCardRegistry;
  CardFrame._globalStore = null;

  const globalStore = new Store();
  const globalTypeRegistry = new TypeRegistry();
  const globalRenderer = new Renderer(document.body, globalTypeRegistry, globalStore);
  const globalAutoFixer = new AutoFixer(globalTypeRegistry, globalStore);
  const globalValidator = new RealTimeValidator(document.body, globalTypeRegistry, globalStore, globalAutoFixer);

  defaultCardTypes
    .forEach(type => globalTypeRegistry.register(type));

  CardFrame.store = globalStore;
  CardFrame.typeRegistry = globalTypeRegistry;
  CardFrame.renderer = globalRenderer;
  CardFrame.autoFixer = globalAutoFixer;
  CardFrame.realTimeValidator = globalValidator;

  window.CardFrame = CardFrame;

  // 全局 Shadow Card Registry
  const _globalShadowCardRegistry = new ShadowCardRegistry();
  CardFrame.shadowCardRegistry = _globalShadowCardRegistry;
  CardFrame.defineShadowCard = () => defineShadowCardElement(_globalShadowCardRegistry);

  if (typeof customElements !== 'undefined') {
    customElements.define('card-frame', CardFrameElement);
    customElements.define('cf-card', CardElement);
  }

})(window);