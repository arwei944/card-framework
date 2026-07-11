/**
 * Security utilities for HTML sanitization, URL filtering, and CSP checks.
 * @module security/Security
 */

import { Utils } from '../utils/Utils.js';

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

  // Delegate to Utils.escapeAttr to avoid code duplication
  escapeAttr(str) {
    return Utils.escapeAttr(str);
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

// Register Security on globalThis so Utils can delegate to it without circular imports
if (typeof globalThis !== 'undefined') {
  globalThis.__CardFrameSecurity = Security;
}
