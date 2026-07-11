/**
 * Security utilities for HTML sanitization, URL filtering, and CSP checks.
 * @module security/Security
 */

import { escapeHtml, escapeAttr } from '../utils/escape.js';

export const Security = {
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

  // Tags whose entire subtree must be dropped rather than unwrapped. Unwrapping
  // these (keeping their children) can activate mutation-XSS via foreign-content
  // (svg/math) namespace confusion or re-parsed raw text (script/style/noscript).
  _dangerousTags: [
    'script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript',
    'svg', 'math', 'link', 'meta', 'base', 'form', 'frame', 'frameset',
    'applet', 'param', 'xml'
  ],

  /**
   * Sanitize an untrusted HTML string against tag/attribute allowlists.
   *
   * THREAT MODEL — read before relying on this for untrusted input:
   *  - This is a best-effort, dependency-free sanitizer intended to defend the
   *    framework's own render pipeline against common XSS payloads (event
   *    handlers, javascript: URLs, script/style injection, dangerous CSS).
   *  - It is NOT a substitute for a formally audited sanitizer. For hostile,
   *    user-generated HTML in high-risk contexts, prefer DOMPurify or render
   *    into a sandboxed context.
   *  - Mutation-XSS (mXSS) is mitigated by (a) dropping foreign-content and
   *    raw-text containers entirely and (b) re-sanitizing until the output is
   *    byte-stable, but no allowlist sanitizer can guarantee immunity against
   *    every browser parser quirk.
   */
  sanitizeHtml(html, options = {}) {
    if (html == null) return '';
    let str = String(html);
    // Idempotent multi-pass: an allowlist sanitizer's serialized output can, when
    // re-parsed by the browser, mutate back into a dangerous shape (mXSS). Keep
    // sanitizing until the result stops changing (bounded to avoid pathological loops).
    for (let pass = 0; pass < 3; pass++) {
      const next = this._sanitizeOnce(str, options);
      if (next === str) return next;
      str = next;
    }
    return str;
  },

  _sanitizeOnce(str, options = {}) {
    const allowedTags = options.allowedTags || this._defaultAllowedTags;
    const allowedAttrs = options.allowedAttrs || this._defaultAllowedAttrs;
    const allowedTagsSet = new Set(allowedTags.map(t => t.toLowerCase()));
    const dangerousTagsSet = new Set(this._dangerousTags);

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = str;

    const allElements = tempDiv.getElementsByTagName('*');
    const elementsToRemove = [];
    const elementsToDrop = [];

    for (let i = allElements.length - 1; i >= 0; i--) {
      const el = allElements[i];
      const tagName = el.tagName.toLowerCase();

      if (dangerousTagsSet.has(tagName)) {
        elementsToDrop.push(el);
        continue;
      }

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

    // Dangerous containers: remove the whole subtree (do NOT preserve children).
    elementsToDrop.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    // Disallowed-but-benign tags: unwrap, preserving their (already-sanitized) children.
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

  _safeUrlProtocols: ['http:', 'https:', 'ftp:', 'ftps:', 'mailto:', 'tel:'],

  _safeDataUrlPattern: /^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|x-icon);/i,

  sanitizeScriptContent(content) {
    if (content == null) return '';
    let str = String(content);

    // Remove complete <script>...</script> blocks (cross-line, case-insensitive)
    str = str.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');

    // Remove any remaining/unclosed <script ...> opening tags (and trailing content)
    str = str.replace(/<script\b[^>]*>[\s\S]*$/gi, '');
    str = str.replace(/<\/script\s*>/gi, '');

    // Remove inline event handlers: onclick="...", onerror='...', onload=foo
    str = str.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
    str = str.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
    str = str.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');

    // Remove javascript: / vbscript: protocols
    str = str.replace(/javascript\s*:/gi, '');
    str = str.replace(/vbscript\s*:/gi, '');

    return str;
  },

  sanitizeUrl(url) {
    if (url == null) return '';
    // Strip null bytes / control chars that can bypass protocol checks
    const str = String(url).replace(/[\u0000-\u001F\u007F]/g, '').trim();

    if (str === '') return '';

    if (!this.isSafeUrl(str)) {
      return '';
    }

    return str;
  },

  isSafeUrl(url) {
    if (url == null) return false;
    const str = String(url).replace(/[\u0000-\u001F\u007F]/g, '').trim();

    if (str === '') return false;

    // Protocol-relative URLs (//evil.com) are NOT automatically safe
    if (str.startsWith('//')) {
      return false;
    }

    // Fragment / absolute-path / relative-path references are safe
    if (str.startsWith('#') || str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) {
      return true;
    }

    // data: URLs — only allow whitelisted image mime types
    if (/^data:/i.test(str)) {
      return this._safeDataUrlPattern.test(str) && !/[<>]|script/i.test(str);
    }

    try {
      const base = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'http://localhost';
      const parsed = new URL(str, base);
      const protocol = parsed.protocol.toLowerCase();
      return this._safeUrlProtocols.includes(protocol);
    } catch (e) {
      return false;
    }
  },

  sanitizeStyle(styleStr) {
    if (styleStr == null) return '';
    let str = String(styleStr);

    for (const pattern of this._dangerousStylePatterns) {
      // Reset lastIndex to avoid state leaking across calls on shared /g regexes
      pattern.lastIndex = 0;
      str = str.replace(pattern, '');
      pattern.lastIndex = 0;
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

  // Delegate to the shared escape primitives (no Utils dependency — avoids a cycle)
  escapeHtml(str) {
    return escapeHtml(str);
  },

  escapeAttr(str) {
    return escapeAttr(str);
  },

  checkCSPCompatibility() {
    const issues = [];

    // The framework is eval-free, so it is compatible with strict script CSP
    // (no eval()/new Function() probe is needed — and probing would itself
    // require new Function(), violating the eval-free guarantee).
    const notes = ['框架源码不使用 eval()/new Function()，兼容严格 script-src CSP。'];

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
      notes,
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
        sanitizedValue = escapeHtml(sanitizedValue);
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
