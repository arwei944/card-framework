/**
 * TypeRegistry - manages card type definitions, inheritance, and validation.
 * @module core/TypeRegistry
 */

import { Utils } from '../utils/Utils.js';
import { Security } from '../security/Security.js';
import { FeedbackSystem } from '../utils/FeedbackSystem.js';

export class TypeRegistry {
  constructor() {
    this.types = new Map();
  }

  /**
   * Register a card type definition.
   * @param {Object} typeDef
   * @param {Object} [options]
   * @param {boolean} [options.allowUnsafeTemplates=false] - allow templates that fail security checks
   * @returns {boolean}
   */
  register(typeDef, options = {}) {
    if (!typeDef || !typeDef.type) {
      FeedbackSystem.warn('类型定义缺少 type 字段');
      return false;
    }
    if (this.types.has(typeDef.type)) {
      FeedbackSystem.warn(`类型 "${typeDef.type}" 已存在`);
      return false;
    }

    const allowUnsafe = options.allowUnsafeTemplates === true || typeDef.allowUnsafeTemplates === true;
    if (!allowUnsafe && typeDef.renderTemplate) {
      const securityResult = Security.checkTemplateSecurity(typeDef.renderTemplate);
      if (!securityResult.safe) {
        const summary = (securityResult.issues || []).map(i => i.message).join('; ');
        FeedbackSystem.error(
          `类型 "${typeDef.type}" 模板未通过安全检查，已拒绝注册`,
          summary || 'unsafe template',
          '如确认安全可传入 register(typeDef, { allowUnsafeTemplates: true })'
        );
        return false;
      }
    }

    const finalTypeDef = this.resolveInheritance(typeDef);
    this.types.set(typeDef.type, finalTypeDef);
    return true;
  }

  resolveInheritance(typeDef, _chain = new Set()) {
    if (!typeDef.extends) return { ...typeDef };

    // 环检测：如果当前类型已在继承链中出现，说明存在循环继承
    if (_chain.has(typeDef.type)) {
      const cyclePath = [..._chain, typeDef.type].join(' → ');
      throw new Error(`检测到循环继承: ${cyclePath}`);
    }
    _chain.add(typeDef.type);

    const parentDef = this.get(typeDef.extends);
    if (!parentDef) {
      FeedbackSystem.warn(`父类型 "${typeDef.extends}" 不存在`);
      return { ...typeDef };
    }

    const resolvedParent = this.resolveInheritance(parentDef, _chain);
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

  unregister(typeName) {
    return this.types.delete(typeName);
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
